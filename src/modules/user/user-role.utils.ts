import { UserRole } from '@src/common/enums/user.enum';

type MezonRoleMember = {
  id?: string | number;
  user_id?: string | number;
};

type MezonRole = {
  name?: unknown;
  role_label?: unknown;
  role_user_list?: {
    role_users?: MezonRoleMember[];
  };
  role_users?: MezonRoleMember[];
  rolename?: unknown;
  title?: unknown;
};

const USER_ROLE_PRIORITY: Record<UserRole, number> = {
  [UserRole.UK]: 0,
  [UserRole.QA]: 1,
  [UserRole.DEV]: 2,
  [UserRole.PM]: 3,
  [UserRole.ADMIN]: 4,
};

export function normalizeUserRole(
  role: UserRole | string | number | null | undefined,
): UserRole {
  switch (Number(role)) {
    case UserRole.ADMIN:
      return UserRole.ADMIN;
    case UserRole.PM:
      return UserRole.PM;
    case UserRole.DEV:
      return UserRole.DEV;
    case UserRole.QA:
      return UserRole.QA;
    default:
      return UserRole.UK;
  }
}

export function mapMezonRoleToUserRole(roleName: string): UserRole {
  const normalized = roleName.trim().toUpperCase();

  if (
    normalized.includes('OWNER') ||
    normalized.includes('ADMIN') ||
    normalized.includes('ADMINISTRATOR')
  ) {
    return UserRole.ADMIN;
  }

  if (
    normalized.includes('MANAGER') ||
    normalized.includes('PROJECT') ||
    normalized.includes('PM') ||
    normalized.includes('PR')
  ) {
    return UserRole.PM;
  }

  if (normalized.includes('DEV') || normalized.includes('DEVELOPER')) {
    return UserRole.DEV;
  }

  if (normalized.includes('QA')) {
    return UserRole.QA;
  }

  return UserRole.UK;
}

export function getHigherPriorityUserRole(
  currentRole: UserRole | string | number | null | undefined,
  nextRole: UserRole | string | number | null | undefined,
): UserRole {
  const current = normalizeUserRole(currentRole);
  const next = normalizeUserRole(nextRole);

  return USER_ROLE_PRIORITY[next] > USER_ROLE_PRIORITY[current]
    ? next
    : current;
}

export function resolveBestMezonRoleForUser(
  roles: unknown[],
  mezonId: string,
): UserRole {
  let resolvedRole = UserRole.UK;

  for (const role of roles) {
    const roleUsers = getMezonRoleUsers(role as MezonRole);

    const isMember = roleUsers.some((member) => {
      const userId = String(member.id || member.user_id || '').trim();
      return userId === mezonId;
    });

    if (!isMember) {
      continue;
    }

    resolvedRole = getHigherPriorityUserRole(
      resolvedRole,
      mapMezonRoleToUserRole(getMezonRoleName(role as MezonRole)),
    );
  }

  return resolvedRole;
}

function getMezonRoleUsers(role: MezonRole): MezonRoleMember[] {
  const roleUsers = role.role_user_list?.role_users ?? role.role_users ?? [];

  return Array.isArray(roleUsers) ? roleUsers : [];
}

function getMezonRoleName(role: MezonRole): string {
  return String(
    role.title || role.name || role.rolename || role.role_label || '',
  ).trim();
}
