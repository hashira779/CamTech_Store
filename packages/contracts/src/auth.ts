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
  roles: string[];
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
  roles: string[];
  isActive: boolean;
  locationId?: string | null;
  createdAt?: string | null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roles: string[];
  locationId?: string | null;
}

export interface UpdateUserInput {
  name?: string;
  roles?: string[];
  isActive?: boolean;
  password?: string;
  locationId?: string | null;
}


/** A registered WebAuthn credential. `rpId` records which relying party it was
 *  created under — staff apps and the storefront use different ones, so a
 *  credential is only valid within its own trust domain. */
export interface PasskeyDto {
  id: string;
  name: string;
  rpId: string;
  backedUp: boolean;
  transports: string[];
  createdAt?: string | null;
  lastUsedAt?: string | null;
}

export interface RoleDto {
  id: string;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
}

export interface CreateRoleInput {
  name: string;
  description?: string | null;
  permissions?: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  permissions?: string[];
}
