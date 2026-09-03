import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './infrastructure/database/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ProductsModule } from './modules/products/products.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SalesModule } from './modules/sales/sales.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OpsModule } from './modules/ops/ops.module';
import { LocationsModule } from './modules/locations/locations.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WmsModule } from './modules/wms/wms.module';
import { TaxesModule } from './modules/taxes/taxes.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { StorageModule } from './modules/storage/storage.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { FinanceModule } from './modules/finance/finance.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { HrModule } from './modules/hr/hr.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { DeveloperModule } from './modules/developer/developer.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { AutomationModule } from './modules/automation/automation.module';

import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PermissionsGuard } from './common/auth/permissions.guard';
import { ResponseEnvelopeInterceptor } from './common/http/response.interceptor';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { RequestIdMiddleware } from './common/context/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    // Global rate limiting (spec §12). Defaults overridable via env.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL_MS', 60_000),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    PrismaModule,
    AuditModule,
    IdentityModule,
    ProductsModule,
    CustomersModule,
    SalesModule,
    InventoryModule,
    OpsModule,
    LocationsModule,
    OrganizationsModule,
    ProcurementModule,
    PromotionsModule,
    PricingModule,
    PaymentsModule,
    WmsModule,
    TaxesModule,
    LoyaltyModule,
    StorageModule,
    NotificationsModule,
    ReportingModule,
    FinanceModule,
    WorkflowModule,
    HrModule,
    AssetsModule,
    ProjectsModule,
    TicketsModule,
    DeveloperModule,
    TelegramModule,
    AutomationModule,
  ],
  providers: [
    // Order matters: rate-limit first, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
