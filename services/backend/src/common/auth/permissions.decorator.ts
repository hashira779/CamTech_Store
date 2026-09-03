import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares the permissions a route requires (spec §66, §68).
 * Enforced by PermissionsGuard. Example: @RequirePermissions('products.write')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
