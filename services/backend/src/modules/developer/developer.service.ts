import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApiKeyGenerator } from './domain/api-key-generator';
import type {
  CreateDeveloperAppInput,
  DeveloperAppDto,
  CreateApiKeyInput,
  ApiKeyDto,
  CreateApiKeyResultDto,
  CreateWebhookSubscriptionInput,
  WebhookSubscriptionDto,
  ApiScope,
  WebhookEvent,
} from '@mystore/contracts';

@Injectable()
export class DeveloperService {
  private readonly logger = new Logger(DeveloperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Developer Apps ─────────────────────────────────────────────

  async listApps(orgId: string): Promise<DeveloperAppDto[]> {
    const apps = await this.prisma.developerApp.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return apps.map((a) => ({
      id: a.id,
      organizationId: a.organizationId,
      name: a.name,
      description: a.description,
      homepageUrl: a.homepageUrl,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  async createApp(orgId: string, input: CreateDeveloperAppInput): Promise<DeveloperAppDto> {
    const app = await this.prisma.developerApp.create({
      data: {
        organizationId: orgId,
        name: input.name,
        description: input.description,
        homepageUrl: input.homepageUrl,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'DEVELOPER_APP_CREATED',
      resourceType: 'DeveloperApp',
      resourceId: app.id,
      metadata: { name: app.name },
    });

    return {
      id: app.id,
      organizationId: app.organizationId,
      name: app.name,
      description: app.description,
      homepageUrl: app.homepageUrl,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
    };
  }

  // ─── API Keys ───────────────────────────────────────────────────

  async listApiKeys(orgId: string): Promise<ApiKeyDto[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      id: k.id,
      organizationId: k.organizationId,
      appId: k.appId,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes as ApiScope[],
      rateLimit: k.rateLimit,
      expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
      lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
      createdAt: k.createdAt.toISOString(),
    }));
  }

  async createApiKey(orgId: string, input: CreateApiKeyInput): Promise<CreateApiKeyResultDto> {
    const { rawKey, prefix, hash } = ApiKeyGenerator.generate('live');

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86400000)
      : null;

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId: orgId,
        appId: input.appId,
        name: input.name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes: input.scopes,
        rateLimit: input.rateLimit || 60,
        expiresAt,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'API_KEY_CREATED',
      resourceType: 'ApiKey',
      resourceId: apiKey.id,
      metadata: { name: apiKey.name, prefix, scopes: input.scopes },
    });

    return {
      id: apiKey.id,
      organizationId: apiKey.organizationId,
      appId: apiKey.appId,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      secretKey: rawKey,
      scopes: apiKey.scopes as ApiScope[],
      rateLimit: apiKey.rateLimit,
      expiresAt: apiKey.expiresAt ? apiKey.expiresAt.toISOString() : null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: apiKey.createdAt.toISOString(),
    };
  }

  async revokeApiKey(orgId: string, id: string): Promise<ApiKeyDto> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!key) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'API_KEY_REVOKED',
      resourceType: 'ApiKey',
      resourceId: id,
      metadata: { name: key.name },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      appId: updated.appId,
      name: updated.name,
      keyPrefix: updated.keyPrefix,
      scopes: updated.scopes as ApiScope[],
      rateLimit: updated.rateLimit,
      expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
      lastUsedAt: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null,
      revokedAt: updated.revokedAt ? updated.revokedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async verifyApiKey(rawKey: string): Promise<{ organizationId: string; scopes: string[] }> {
    const hash = ApiKeyGenerator.hashKey(rawKey);
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: hash },
    });

    if (!key || key.revokedAt) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Touch last used timestamp asynchronously
    this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch((err) => this.logger.error('Failed to touch API key lastUsedAt', err));

    return { organizationId: key.organizationId, scopes: key.scopes };
  }

  // ─── Webhooks ───────────────────────────────────────────────────

  async listWebhookSubscriptions(orgId: string): Promise<WebhookSubscriptionDto[]> {
    const subs = await this.prisma.webhookSubscription.findMany({
      where: { organizationId: orgId },
      include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { createdAt: 'desc' },
    });

    return subs.map((s) => ({
      id: s.id,
      organizationId: s.organizationId,
      url: s.url,
      description: s.description,
      events: s.events as WebhookEvent[],
      isActive: s.isActive,
      deliveries: (s.deliveries || []).map((d) => ({
        id: d.id,
        subscriptionId: d.subscriptionId,
        event: d.event,
        payload: d.payload as Record<string, unknown>,
        statusCode: d.statusCode,
        responseBody: d.responseBody,
        success: d.success,
        attempts: d.attempts,
        createdAt: d.createdAt.toISOString(),
      })),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async createWebhookSubscription(
    orgId: string,
    input: CreateWebhookSubscriptionInput,
  ): Promise<WebhookSubscriptionDto> {
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const sub = await this.prisma.webhookSubscription.create({
      data: {
        organizationId: orgId,
        url: input.url,
        secret,
        description: input.description,
        events: input.events,
        isActive: true,
      },
      include: { deliveries: true },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'WEBHOOK_SUBSCRIBED',
      resourceType: 'WebhookSubscription',
      resourceId: sub.id,
      metadata: { url: sub.url, events: sub.events },
    });

    return {
      id: sub.id,
      organizationId: sub.organizationId,
      url: sub.url,
      description: sub.description,
      events: sub.events as WebhookEvent[],
      isActive: sub.isActive,
      deliveries: [],
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  }

  async deleteWebhookSubscription(orgId: string, id: string): Promise<{ success: boolean }> {
    const sub = await this.prisma.webhookSubscription.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!sub) {
      throw new NotFoundException(`Webhook subscription ${id} not found`);
    }

    await this.prisma.webhookSubscription.delete({ where: { id } });

    await this.audit.record({
      organizationId: orgId,
      action: 'WEBHOOK_DELETED',
      resourceType: 'WebhookSubscription',
      resourceId: id,
      metadata: { url: sub.url },
    });

    return { success: true };
  }
}
