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
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { TelegramService } from './telegram.service';
import {
  BindTelegramChatDto,
  SendTelegramBroadcastDto,
  TelegramWebhookPayloadDto,
} from './dto/telegram.dto';

@ApiTags('Telegram Platform & Bot')
@Controller({ path: 'telegram', version: '1' })
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Public Telegram Bot webhook receiver' })
  async handleWebhook(@Body() payload: TelegramWebhookPayloadDto) {
    return this.telegramService.processWebhookUpdate(payload);
  }

  @Get('bindings')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TELEGRAM_MANAGE)
  @ApiOperation({ summary: 'List organization registered Telegram chat bindings' })
  async listBindings(@CurrentUser() user: AuthenticatedUser) {
    return this.telegramService.listBindings(user.organizationId);
  }

  @Post('bindings')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TELEGRAM_MANAGE)
  @ApiOperation({ summary: 'Bind a Telegram chat ID to this organization' })
  async createBinding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BindTelegramChatDto,
  ) {
    return this.telegramService.createBinding(user.organizationId, dto as any, user.id);
  }

  @Delete('bindings/:id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TELEGRAM_MANAGE)
  @ApiOperation({ summary: 'Unbind a Telegram chat from this organization' })
  async deleteBinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.telegramService.deleteBinding(user.organizationId, id);
  }

  @Post('broadcast')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TELEGRAM_MANAGE)
  @ApiOperation({ summary: 'Send a broadcast alert to all active bound chats' })
  async sendBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendTelegramBroadcastDto,
  ) {
    return this.telegramService.sendBroadcast(user.organizationId, dto.message);
  }
}
