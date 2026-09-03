/**
 * Enterprise security e2e (spec §107): proves cross-tenant isolation, RBAC /
 * privilege escalation defence, token abuse rejection, and that tenant ownership
 * is derived server-side — over the REAL HTTP stack, not mocks.
 *
 * Uses an isolated throwaway SQLite database so it never touches dev data.
 */

// Unique DB file per run so there is never residual data and no destructive
// reset is needed. Must be set BEFORE the app (and Prisma) initialise — dotenv
// does not override an already-set process.env value, so this wins over .env.
const SCHEMA_NAME = `test_e2e_${Date.now()}`;
process.env.DATABASE_URL = `postgresql://camtech:camtech123@localhost:5432/camtechStore?schema=${SCHEMA_NAME}`;
process.env.JWT_SECRET = 'e2e-test-secret-please-ignore-0123456789';
process.env.JWT_EXPIRES_IN = '1h';
process.env.THROTTLE_LIMIT = '1000';
process.env.NODE_ENV = 'test';

import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

const backendRoot = join(__dirname, '..');


describe('Security & multi-tenancy (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // Fresh, isolated DB every run (unique filename); clear any stray sidecars,
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: backendRoot,
      env: process.env,
      stdio: 'pipe',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'ready', method: RequestMethod.GET },
        { path: 'metrics', method: RequestMethod.GET },
      ],
    });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await seedTwoTenants();
  }, 60_000);

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA_NAME}" CASCADE;`);
      }
    } catch (e) {}
    await app?.close();
  });

  async function seedTwoTenants(): Promise<void> {
    const orgA = await prisma.organization.create({ data: { name: 'Org A', slug: 'org-a' } });
    const orgB = await prisma.organization.create({ data: { name: 'Org B', slug: 'org-b' } });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const pw = await bcrypt.hash('Secret123!', 10);
    await prisma.user.createMany({
      data: [
        {
          organizationId: orgA.id,
          email: 'admin-a@acme.test',
          name: 'Admin A',
          passwordHash: pw,
          roles: JSON.stringify(['ORG_ADMIN']),
        },
        {
          organizationId: orgA.id,
          email: 'cashier-a@acme.test',
          name: 'Cashier A',
          passwordHash: pw,
          roles: JSON.stringify(['CASHIER']),
        },
      ],
    });

    await prisma.product.create({
      data: {
        organizationId: orgA.id,
        name: 'Org A Product',
        variants: {
          create: [{ organizationId: orgA.id, sku: 'A-1', sellPrice: 5, costPrice: 2 }],
        },
      },
    });
    // A product that belongs ONLY to Org B — Org A must never see it.
    await prisma.product.create({
      data: {
        organizationId: orgB.id,
        name: 'Org B Secret',
        variants: {
          create: [{ organizationId: orgB.id, sku: 'B-SECRET', sellPrice: 9, costPrice: 3 }],
        },
      },
    });
  }

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });

  it('rejects unauthenticated access (401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/products');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 'MISSING_TOKEN' });
  });

  it('rejects a garbage token (401)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/products')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects wrong password without leaking which field (401)', async () => {
    const res = await login('admin-a@acme.test', 'wrong');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('NEVER returns another tenant’s data', async () => {
    const token = (await login('admin-a@acme.test', 'Secret123!')).body.data.accessToken;
    const res = await request(app.getHttpServer())
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      organizationId: string;
      variants: Array<{ sku: string }>;
    }>;
    expect(items.every((p) => p.organizationId === orgAId)).toBe(true);
    expect(items.some((p) => p.variants.some((v) => v.sku === 'A-1'))).toBe(true);
    expect(items.some((p) => p.variants.some((v) => v.sku === 'B-SECRET'))).toBe(false); // isolation
    expect(items.some((p) => p.organizationId === orgBId)).toBe(false);
  });

  it('blocks privilege escalation: CASHIER cannot write (403)', async () => {
    const token = (await login('cashier-a@acme.test', 'Secret123!')).body.data.accessToken;
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Nope',
        variants: [{ sku: 'HACK-1', costPrice: 1, sellPrice: 2 }],
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  });

  it('derives tenant from the token, ignoring client-supplied organizationId', async () => {
    const token = (await login('admin-a@acme.test', 'Secret123!')).body.data.accessToken;
    const res = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      // Attempt to plant the row into Org B:
      .send({
        name: 'Latte',
        variants: [{ sku: 'A-2', costPrice: 1, sellPrice: 4 }],
        organizationId: orgBId,
      });

    // Unknown field is rejected outright (whitelist), so spoofing can't even parse.
    expect(res.status).toBe(400);

    // And a clean create lands in the caller's own org, with server-derived margin.
    const clean = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Mocha',
        variants: [{ sku: 'A-3', costPrice: 1, sellPrice: 4 }],
      });
    expect(clean.status).toBe(201);
    expect(clean.body.data.organizationId).toBe(orgAId);
    expect(clean.body.data.variants[0].marginPct).toBe(75);
  });

  it('exposes liveness, readiness and metrics for orchestration', async () => {
    const health = await request(app.getHttpServer()).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('ok');

    const ready = await request(app.getHttpServer()).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.data.db).toBe('up');

    const metrics = await request(app.getHttpServer()).get('/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.text).toContain('process_cpu_user_seconds_total');
  });
});
