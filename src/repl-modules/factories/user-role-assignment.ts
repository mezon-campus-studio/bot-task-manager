import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';
import UserRoleAssignmentEntity from '@src/modules/user-role-assignment/user-role-assignment.entity';
import { Factory } from './factory';
import { project } from './project';
import { role } from './role';
import { team } from './team';
import { user } from './user';

export const userRoleAssignment = Factory.forEntity<UserRoleAssignmentEntity>(
  UserRoleAssignmentEntity,
  async (input) => {
    const scopeType = input.scopeType ?? RoleScopeType.SYSTEM;
    const userId = input.userId ?? (await user({})).id;
    const roleId = input.roleId ?? (await role({ scopeType })).id;

    let projectId = input.projectId ?? null;
    let teamId = input.teamId ?? null;

    if (scopeType === RoleScopeType.PROJECT && projectId == null) {
      projectId = (await project({})).id;
    }

    if (scopeType === RoleScopeType.TEAM && teamId == null) {
      const createdTeam = await team({});
      teamId = createdTeam.id;
      projectId = input.projectId ?? createdTeam.projectId;
    }

    return {
      ...input,
      assignedByUserId: input.assignedByUserId ?? null,
      projectId,
      roleId,
      scopeType,
      teamId,
      userId,
    };
  },
);
