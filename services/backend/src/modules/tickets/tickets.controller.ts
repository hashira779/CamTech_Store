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
import {
  PERMISSIONS,
  type AuthenticatedUser,
  type TicketPriority,
  type TicketStatus,
} from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { TicketsService } from './tickets.service';
import {
  CreateServiceTicketDto,
  AddTicketCommentDto,
  UpdateTicketStatusDto,
} from './dto/tickets.dto';

@ApiTags('Service Management & Helpdesk')
@ApiBearerAuth()
@Controller({ path: 'tickets', version: '1' })
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TICKETS_READ)
  @ApiOperation({ summary: 'List service tickets' })
  async listTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: TicketStatus,
    @Query('priority') priority?: TicketPriority,
  ) {
    return this.ticketsService.listTickets(user.organizationId, status, priority);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TICKETS_READ)
  @ApiOperation({ summary: 'Get service ticket details and comments' })
  async getTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.ticketsService.getTicket(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Create a new service support ticket' })
  async createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceTicketDto,
  ) {
    return this.ticketsService.createTicket(user.organizationId, dto as any, user.id);
  }

  @Post(':id/comments')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Add a comment or internal note to a ticket' })
  async addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddTicketCommentDto,
  ) {
    return this.ticketsService.addComment(
      user.organizationId,
      id,
      dto as any,
      user.id,
      user.name || 'Support Agent',
    );
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Update ticket resolution status' })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateStatus(
      user.organizationId,
      id,
      dto.status,
      dto.resolution,
      user.id,
    );
  }
}
