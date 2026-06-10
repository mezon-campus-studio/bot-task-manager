import { PROJECT_DEFAULT_ROLE_KEYS } from './project-default-roles.constant';

export const PROJECT_DEFAULT_PERMISSIONS = [
  {
    action: 'read',
    description: 'Read project data',
    key: 'projects.read',
    resource: 'projects',
  },
  {
    action: 'update',
    description: 'Update project data',
    key: 'projects.update',
    resource: 'projects',
  },
  {
    action: 'manage',
    description: 'Manage project settings',
    key: 'projects.manage',
    resource: 'projects',
  },
  {
    action: 'invite',
    description: 'Invite users to teams',
    key: 'teams.invite',
    resource: 'teams',
  },
] as const;

export const PROJECT_DEFAULT_ROLE_PERMISSIONS = {
  [PROJECT_DEFAULT_ROLE_KEYS.admin]: [
    'projects.read',
    'projects.update',
    'teams.invite',
  ],
  [PROJECT_DEFAULT_ROLE_KEYS.member]: ['projects.read'],
  [PROJECT_DEFAULT_ROLE_KEYS.owner]: PROJECT_DEFAULT_PERMISSIONS.map(
    ({ key }) => key,
  ),
} as const;
