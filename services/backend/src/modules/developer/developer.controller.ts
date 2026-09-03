import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { DeveloperService } from './developer.service';
import {
  CreateDeveloperAppDto,
  CreateApiKeyDto,
  CreateWebhookSubscriptionDto,
} from './dto/developer.dto';

@ApiTags('Partner & Developer Platform')
@ApiBearerAuth()
@Controller({ path: 'developers', version: '1' })
export class DeveloperController {
  constructor(private readonly devService: DeveloperService) {}

  // ─── Apps ───────────────────────────────────────────────────────

  @Get('apps')
  @RequirePermissions(PERMISSIONS.DEVELOPER_READ)
  @ApiOperation({ summary: 'List registered developer applications' })
  async listApps(@CurrentUser() user: AuthenticatedUser) {
    return this.devService.listApps(user.organizationId);
  }

  @Post('apps')
  @RequirePermissions(PERMISSIONS.DEVELOPER_WRITE)
  @ApiOperation({ summary: 'Register a developer integration application' })
  async createApp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDeveloperAppDto,
  ) {
    return this.devService.createApp(user.organizationId, dto as any);
  }

  // ─── API Keys ───────────────────────────────────────────────────

  @Get('keys')
  @RequirePermissions(PERMISSIONS.DEVELOPER_READ)
  @ApiOperation({ summary: 'List tenant API keys (hashes obscured)' })
  async listKeys(@CurrentUser() user: AuthenticatedUser) {
    return this.devService.listApiKeys(user.organizationId);
  }

  @Post('keys')
  @RequirePermissions(PERMISSIONS.DEVELOPER_WRITE)
  @ApiOperation({ summary: 'Generate a new scoped API key (secret displayed once)' })
  async createKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.devService.createApiKey(user.organizationId, dto as any);
  }

  @Delete('keys/:id')
  @RequirePermissions(PERMISSIONS.DEVELOPER_WRITE)
  @ApiOperation({ summary: 'Revoke an active API key' })
  async revokeKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.devService.revokeApiKey(user.organizationId, id);
  }

  // ─── Webhooks ───────────────────────────────────────────────────

  @Get('webhooks')
  @RequirePermissions(PERMISSIONS.DEVELOPER_READ)
  @ApiOperation({ summary: 'List active outbound webhook subscriptions' })
  async listWebhooks(@CurrentUser() user: AuthenticatedUser) {
    return this.devService.listWebhookSubscriptions(user.organizationId);
  }

  @Post('webhooks')
  @RequirePermissions(PERMISSIONS.WEBHOOKS_MANAGE)
  @ApiOperation({ summary: 'Subscribe a webhook endpoint to platform events' })
  async createWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWebhookSubscriptionDto,
  ) {
    return this.devService.createWebhookSubscription(user.organizationId, dto as any);
  }

  @Delete('webhooks/:id')
  @RequirePermissions(PERMISSIONS.WEBHOOKS_MANAGE)
  @ApiOperation({ summary: 'Remove a webhook subscription' })
  async deleteWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.devService.deleteWebhookSubscription(user.organizationId, id);
  }
}
