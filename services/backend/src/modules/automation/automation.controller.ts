import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AutomationService } from './automation.service';
import {
  CreateAutomationFlowDto,
  UpdateAutomationFlowDto,
  ExecuteFlowDto,
} from './dto/automation.dto';

@ApiTags('Flow Automation Platform (n8n Engine)')
@Controller({ path: 'flows', version: '1' })
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  // ─── Flow Management ────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.AUTOMATION_READ)
  @ApiOperation({ summary: 'List all automation flow graphs for organization' })
  async listFlows(@CurrentUser() user: AuthenticatedUser) {
    return this.automationService.listFlows(user.organizationId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.AUTOMATION_READ)
  @ApiOperation({ summary: 'Get details and graph nodes of a single automation flow' })
  async getFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.automationService.getFlow(user.organizationId, id);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.AUTOMATION_WRITE)
  @ApiOperation({ summary: 'Create a new node-based automation flow graph' })
  async createFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAutomationFlowDto,
  ) {
    return this.automationService.createFlow(user.organizationId, dto as any);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.AUTOMATION_WRITE)
  @ApiOperation({ summary: 'Update an existing automation flow graph or toggle active' })
  async updateFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationFlowDto,
  ) {
    return this.automationService.updateFlow(user.organizationId, id, dto as any);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.AUTOMATION_WRITE)
  @ApiOperation({ summary: 'Delete an automation flow graph' })
  async deleteFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.automationService.deleteFlow(user.organizationId, id);
  }

  // ─── Execution ──────────────────────────────────────────────────

  @Post(':id/execute')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.AUTOMATION_EXECUTE)
  @ApiOperation({ summary: 'Manually test / trigger an automation flow execution' })
  async executeFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ExecuteFlowDto,
  ) {
    return this.automationService.executeFlow(
      user.organizationId,
      id,
      dto.payload || {},
      'MANUAL',
    );
  }

  @Get(':id/executions')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.AUTOMATION_READ)
  @ApiOperation({ summary: 'List past execution traces for an automation flow' })
  async listExecutions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.automationService.listExecutions(user.organizationId, id);
  }

  // ─── Inbound Webhook Trigger ────────────────────────────────────

  @Public()
  @Post(':id/webhook')
  @ApiOperation({ summary: 'Inbound webhook trigger to initiate flow execution' })
  async triggerWebhook(
    @Param('id') id: string,
    @Body() payload: Record<string, any>,
  ) {
    // Determine tenant organization through flow lookup
    const flow = await this.automationService.getFlow('system', id).catch(() => null);
    const orgId = flow ? flow.organizationId : 'system';
    return this.automationService.executeFlow(orgId, id, payload, 'WEBHOOK');
  }
}
