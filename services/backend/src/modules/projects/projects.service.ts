import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type {
  CreateProjectInput,
  CreateProjectTaskInput,
  LogTimesheetInput,
  ProjectDto,
  ProjectTaskDto,
  TimesheetEntryDto,
  ProjectStatus,
  TaskStatus,
} from '@mystore/contracts';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listProjects(orgId: string): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { organizationId: orgId },
      include: {
        tasks: { include: { timesheets: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => this.mapProjectDto(p));
  }

  async getProject(orgId: string, id: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: orgId },
      include: {
        tasks: { include: { timesheets: true } },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return this.mapProjectDto(project);
  }

  async createProject(orgId: string, input: CreateProjectInput): Promise<ProjectDto> {
    const existing = await this.prisma.project.findUnique({
      where: { organizationId_code: { organizationId: orgId, code: input.code } },
    });
    if (existing) {
      throw new ConflictException(`Project code '${input.code}' already exists`);
    }

    const created = await this.prisma.project.create({
      data: {
        organizationId: orgId,
        code: input.code,
        name: input.name,
        description: input.description,
        budget: input.budget || 0,
        status: input.status || 'PLANNING',
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
      include: { tasks: { include: { timesheets: true } } },
    });

    await this.audit.record({
      organizationId: orgId,
      action: 'PROJECT_CREATED',
      resourceType: 'Project',
      resourceId: created.id,
      metadata: { code: created.code, name: created.name },
    });

    return this.mapProjectDto(created);
  }

  async createTask(orgId: string, projectId: string, input: CreateProjectTaskInput): Promise<ProjectTaskDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const task = await this.prisma.projectTask.create({
      data: {
        projectId,
        title: input.title,
        description: input.description,
        status: input.status || 'TODO',
        assignedToId: input.assignedToId,
        estimatedHours: input.estimatedHours || 0,
        actualHours: 0,
      },
      include: { timesheets: true },
    });

    return {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status as TaskStatus,
      assignedToId: task.assignedToId,
      estimatedHours: Number(task.estimatedHours),
      actualHours: Number(task.actualHours),
      timesheets: [],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async logTimesheet(
    orgId: string,
    taskId: string,
    input: LogTimesheetInput,
    workerId?: string,
  ): Promise<TimesheetEntryDto> {
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, project: { organizationId: orgId } },
    });
    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const newActual = Number(task.actualHours) + input.hours;

    const entry = await this.prisma.$transaction(async (tx) => {
      const ts = await tx.timesheetEntry.create({
        data: {
          taskId,
          workerId: workerId || input.workerId,
          hours: input.hours,
          date: input.date ? new Date(input.date) : new Date(),
          notes: input.notes,
        },
      });

      await tx.projectTask.update({
        where: { id: taskId },
        data: { actualHours: newActual },
      });

      return ts;
    });

    return {
      id: entry.id,
      taskId: entry.taskId,
      workerId: entry.workerId,
      hours: Number(entry.hours),
      date: entry.date.toISOString(),
      notes: entry.notes,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private mapProjectDto(p: any): ProjectDto {
    let totalHours = 0;
    const tasks = (p.tasks || []).map((t: any) => {
      const actual = Number(t.actualHours);
      totalHours += actual;
      return {
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status as TaskStatus,
        assignedToId: t.assignedToId,
        estimatedHours: Number(t.estimatedHours),
        actualHours: actual,
        timesheets: (t.timesheets || []).map((ts: any) => ({
          id: ts.id,
          taskId: ts.taskId,
          workerId: ts.workerId,
          hours: Number(ts.hours),
          date: ts.date.toISOString(),
          notes: ts.notes,
          createdAt: ts.createdAt.toISOString(),
        })),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });

    return {
      id: p.id,
      organizationId: p.organizationId,
      code: p.code,
      name: p.name,
      description: p.description,
      budget: Number(p.budget),
      status: p.status as ProjectStatus,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      endDate: p.endDate ? p.endDate.toISOString() : null,
      tasks,
      totalActualHours: Number(totalHours.toFixed(2)),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
