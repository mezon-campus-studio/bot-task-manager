import { SetMetadata } from '@nestjs/common';

export const PROJECT_ROLES_KEY = 'project_roles';
export const ProjectRoles = (...roles: string[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);
