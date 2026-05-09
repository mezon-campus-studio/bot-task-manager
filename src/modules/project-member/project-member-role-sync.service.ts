import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { PROJECT_DEFAULT_ROLE_KEYS } from '@src/modules/project/constants';
import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';
import RoleEntity from '@src/modules/role/role.entity';
import UserRoleAssignmentEntity from '@src/modules/user-role-assignment/user-role-assignment.entity';

type SyncProjectMemberRoleInput = {
  assignedByUserId?: string | null;
  projectId: number;
  userId: string;
};

@Injectable()
export class ProjectMemberRoleSyncService {
  async assignDefaultProjectMemberRole(
    input: SyncProjectMemberRoleInput,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    const memberRole = await this.getDefaultProjectMemberRole(
      transactionalEntityManager,
    );

    const existingAssignment = await transactionalEntityManager.findOne(
      UserRoleAssignmentEntity,
      {
        where: {
          projectId: input.projectId,
          roleId: memberRole.id,
          scopeType: RoleScopeType.PROJECT,
          teamId: IsNull(),
          userId: input.userId,
        },
      },
    );

    if (existingAssignment != null) {
      return;
    }

    const assignment = transactionalEntityManager.create(
      UserRoleAssignmentEntity,
      {
        assignedByUserId: input.assignedByUserId ?? null,
        projectId: input.projectId,
        roleId: memberRole.id,
        scopeType: RoleScopeType.PROJECT,
        teamId: null,
        userId: input.userId,
      },
    );

    await transactionalEntityManager.save(assignment);
  }

  async removeDefaultProjectMemberRole(
    projectId: number,
    userId: string,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    const memberRole = await transactionalEntityManager.findOne(RoleEntity, {
      where: { key: PROJECT_DEFAULT_ROLE_KEYS.member },
    });

    if (memberRole == null) {
      return;
    }

    const assignment = await transactionalEntityManager.findOne(
      UserRoleAssignmentEntity,
      {
        where: {
          projectId,
          roleId: memberRole.id,
          scopeType: RoleScopeType.PROJECT,
          teamId: IsNull(),
          userId,
        },
      },
    );

    if (assignment == null) {
      return;
    }

    await transactionalEntityManager.delete(UserRoleAssignmentEntity, {
      id: assignment.id,
    });
  }

  private async getDefaultProjectMemberRole(
    transactionalEntityManager: EntityManager,
  ): Promise<RoleEntity> {
    const memberRole = await transactionalEntityManager.findOne(RoleEntity, {
      where: { key: PROJECT_DEFAULT_ROLE_KEYS.member },
    });

    if (memberRole == null) {
      throw new NotFoundException('Default project member role not found');
    }

    return memberRole;
  }
}
