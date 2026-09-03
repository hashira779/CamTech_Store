import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  SendNotificationDto,
  UpdateNotificationConfigDto,
  ListNotificationsQueryDto,
} from './dto/notifications.dto';

@ApiTags('Notifications & Alerts')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  @ApiOperation({ summary: 'List notifications for tenant' })
  async listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listNotifications(user.organizationId, query as any);
  }

  @Post('send')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_WRITE)
  @ApiOperation({ summary: 'Dispatch a transactional notification' })
  async sendNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendNotificationDto,
  ) {
    return this.notificationsService.dispatch(user.organizationId, dto as any);
  }

  @Patch(':id/read')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  @ApiOperation({ summary: 'Mark an in-app notification as read' })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(user.organizationId, id);
  }

  @Post('read-all')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  @ApiOperation({ summary: 'Mark all unread in-app notifications as read' })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.organizationId);
  }

  @Get('config')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  @ApiOperation({ summary: 'Get notification channel configurations' })
  async getConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getOrCreateConfig(user.organizationId);
  }

  @Patch('config')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_WRITE)
  @ApiOperation({ summary: 'Update channel configurations (Telegram, Email)' })
  async updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationConfigDto,
  ) {
    return this.notificationsService.updateConfig(user.organizationId, user.id, dto as any);
  }

  @Get('stats')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_READ)
  @ApiOperation({ summary: 'Get notification delivery statistics' })
  async getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getStats(user.organizationId);
  }

  @Post('test')
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_WRITE)
  @ApiOperation({ summary: 'Send an immediate test alert to configured channels' })
  async sendTestNotification(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.sendTestNotification(user.organizationId, user.id);
  }
}
