import type { AuthenticatedUser, Role } from '@mystore/contracts';

export type { AuthenticatedUser };

/** Shape encoded inside the JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  org: string;
  roles: Role[];
  perms: string[];
}

/** Express request augmented with the authenticated principal. */
export interface RequestWithUser {
  user?: AuthenticatedUser;
  requestId?: string;
  ip?: string;
  method: string;
  url: string;
  header(name: string): string | undefined;
}
