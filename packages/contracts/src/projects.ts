import { z } from 'zod';

export const PROJECT_STATUSES = [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const createProjectSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  budget: z.number().min(0).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createProjectTaskSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assignedToId: z.string().optional(),
  estimatedHours: z.number().min(0).optional(),
});
export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;

export const logTimesheetSchema = z.object({
  taskId: z.string().optional(),
  workerId: z.string().optional(),
  hours: z.number().positive(),
  date: z.string().optional(),
  notes: z.string().optional(),
});
export type LogTimesheetInput = z.infer<typeof logTimesheetSchema>;

export interface TimesheetEntryDto {
  id: string;
  taskId: string;
  workerId?: string | null;
  hours: number;
  date: string;
  notes?: string | null;
  createdAt: string;
}

export interface ProjectTaskDto {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  assignedToId?: string | null;
  estimatedHours: number;
  actualHours: number;
  timesheets?: TimesheetEntryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  budget: number;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  tasks?: ProjectTaskDto[];
  totalActualHours?: number;
  createdAt: string;
  updatedAt: string;
}
