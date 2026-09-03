import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser, type WorkflowStatus } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { WorkflowService } from './workflow.service';
import { SubmitApprovalDto, ReviewWorkflowStepDto } from './dto/workflow.dto';

@ApiTags('Workflow & Approvals')
@ApiBearerAuth()
@Controller({ path: 'workflows', version: '1' })
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('instances')
  @RequirePermissions(PERMISSIONS.WORKFLOW_READ)
  @ApiOperation({ summary: 'List workflow approval instances' })
  async listInstances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: WorkflowStatus,
  ) {
    return this.workflowService.listInstances(user.organizationId, status);
  }

  @Get('instances/:id')
  @RequirePermissions(PERMISSIONS.WORKFLOW_READ)
  @ApiOperation({ summary: 'Get workflow instance with approval steps and audit logs' })
  async getInstance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.workflowService.getInstance(user.organizationId, id);
  }

  @Post('instances')
  @RequirePermissions(PERMISSIONS.WORKFLOW_MANAGE)
  @ApiOperation({ summary: 'Submit an entity for multi-step approval' })
  async submitApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitApprovalDto,
  ) {
    return this.workflowService.submitApproval(user.organizationId, dto as any, user.id);
  }

  @Post('instances/:instanceId/steps/:stepId/review')
  @RequirePermissions(PERMISSIONS.WORKFLOW_APPROVE)
  @ApiOperation({ summary: 'Review (Approve/Reject) an approval step' })
  async reviewStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instanceId') instanceId: string,
    @Param('stepId') stepId: string,
    @Body() dto: ReviewWorkflowStepDto,
  ) {
    return this.workflowService.reviewStep(
      user.organizationId,
      instanceId,
      stepId,
      dto as any,
      user.id,
    );
  }
}
