import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';

export const PROJECT_DEFAULT_ROLE_KEYS = {
  admin: 'PROJECT_ADMIN',
  member: 'PROJECT_MEMBER',
  owner: 'PROJECT_OWNER',
} as const;

export const PROJECT_DEFAULT_ROLES = {
  admin: {
    description: 'Default project admin role',
    isSystem: true,
    key: PROJECT_DEFAULT_ROLE_KEYS.admin,
    name: 'Project Admin',
    scopeType: RoleScopeType.PROJECT,
  },
  member: {
    description: 'Default project member role',
    isSystem: true,
    key: PROJECT_DEFAULT_ROLE_KEYS.member,
    name: 'Project Member',
    scopeType: RoleScopeType.PROJECT,
  },
  owner: {
    description: 'Default project owner role',
    isSystem: true,
    key: PROJECT_DEFAULT_ROLE_KEYS.owner,
    name: 'Project Owner',
    scopeType: RoleScopeType.PROJECT,
  },
} as const;
