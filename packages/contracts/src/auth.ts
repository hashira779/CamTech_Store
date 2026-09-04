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
  expiresIn: string;
  user: AuthenticatedUser;
}
