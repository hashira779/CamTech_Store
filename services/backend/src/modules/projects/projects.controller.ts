import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@mystore/contracts';
import { RequirePermissions } from '../../common/auth/permissions.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  CreateProjectTaskDto,
  LogTimesheetDto,
} from './dto/projects.dto';

@ApiTags('Projects & Billing')
@ApiBearerAuth()
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @ApiOperation({ summary: 'List enterprise projects with task rollups' })
  async listProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.listProjects(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_READ)
  @ApiOperation({ summary: 'Get project details with tasks and timesheets' })
  async getProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectsService.getProject(user.organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECTS_WRITE)
  @ApiOperation({ summary: 'Create a new project' })
  async createProject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.createProject(user.organizationId, dto as any);
  }

  @Post(':id/tasks')
  @RequirePermissions(PERMISSIONS.PROJECTS_WRITE)
  @ApiOperation({ summary: 'Add a task to a project' })
  async createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Body() dto: CreateProjectTaskDto,
  ) {
    return this.projectsService.createTask(user.organizationId, projectId, dto as any);
  }

  @Post('tasks/:taskId/timesheets')
  @RequirePermissions(PERMISSIONS.PROJECTS_WRITE)
  @ApiOperation({ summary: 'Log billable/actual hours to a project task' })
  async logTimesheet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: LogTimesheetDto,
  ) {
    return this.projectsService.logTimesheet(user.organizationId, taskId, dto as any, user.id);
  }
}
