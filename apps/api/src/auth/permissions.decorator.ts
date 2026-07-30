import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@room/auth';

export const REQUIRED_PERMISSIONS = Symbol('REQUIRED_PERMISSIONS');

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
