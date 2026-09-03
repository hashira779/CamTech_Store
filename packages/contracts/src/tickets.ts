import { z } from 'zod';

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const createServiceTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.string().optional(),
  assignedToId: z.string().optional(),
  customerId: z.string().optional(),
});
export type CreateServiceTicketInput = z.infer<typeof createServiceTicketSchema>;

export const addTicketCommentSchema = z.object({
  comment: z.string().min(1),
  isInternal: z.boolean().optional(),
});
export type AddTicketCommentInput = z.infer<typeof addTicketCommentSchema>;

export interface TicketCommentDto {
  id: string;
  ticketId: string;
  authorId?: string | null;
  authorName: string;
  comment: string;
  isInternal: boolean;
  createdAt: string;
}

export interface ServiceTicketDto {
  id: string;
  organizationId: string;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: string;
  assignedToId?: string | null;
  reporterId?: string | null;
  customerId?: string | null;
  resolution?: string | null;
  resolvedAt?: string | null;
  comments?: TicketCommentDto[];
  createdAt: string;
  updatedAt: string;
}
