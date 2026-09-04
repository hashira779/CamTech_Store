import { z } from 'zod';
import type { Role } from './permissions';

export const loginSchema = z.object({
  email: z.string().min(3, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  roles: Role[];
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  expiresIn?: string;
  user: AuthenticatedUser;
}

export interface UserDetailDto {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  roles: Role[];
  isActive: boolean;
  locationId?: string | null;
  createdAt?: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roles: Role[];
  locationId?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  roles?: Role[];
  isActive?: boolean;
  password?: string;
  locationId?: string | null;
}

