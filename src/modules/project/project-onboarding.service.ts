import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import PermissionEntity from '@src/modules/permission/permission.entity';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import ProjectMemberEntity from '@src/modules/project-member/project-member.entity';
import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';
import RoleEntity from '@src/modules/role/role.entity';
import RolePermissionEntity from '@src/modules/role-permission/role-permission.entity';
import TeamEntity from '@src/modules/team/team.entity';
import UserRoleAssignmentEntity from '@src/modules/user-role-assignment/user-role-assignment.entity';
import {
  PROJECT_DEFAULT_PERMISSIONS,
  PROJECT_DEFAULT_ROLES,
  PROJECT_DEFAULT_ROLE_KEYS,
  PROJECT_DEFAULT_ROLE_PERMISSIONS,
  PROJECT_DEFAULT_TEAM,
} from './constants';
import ProjectEntity from './project.entity';

type DefaultProjectRoleInput =
  (typeof PROJECT_DEFAULT_ROLES)[keyof typeof PROJECT_DEFAULT_ROLES];

type DefaultProjectPermissionInput =
  (typeof PROJECT_DEFAULT_PERMISSIONS)[number];

type DefaultProjectRoles = {
  admin: RoleEntity;
  member: RoleEntity;
  owner: RoleEntity;
};

@Injectable()
export class ProjectOnboardingService {
  async initializeProjectDefaults(
    project: ProjectEntity,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    const roles = await this.findOrCreateDefaultRoles(
      transactionalEntityManager,
    );
    const permissions = await this.findOrCreateDefaultPermissions(
      transactionalEntityManager,
    );

    await this.createDefaultProjectTeam(project, transactionalEntityManager);
    await this.createDefaultRolePermissions(
      roles,
      permissions,
      transactionalEntityManager,
    );
    await this.createProjectOwnerMembership(
      project,
      transactionalEntityManager,
    );
    await this.createProjectOwnerRoleAssignment(
      project,
      roles.owner,
      transactionalEntityManager,
    );
  }

  private async createDefaultProjectTeam(
    project: ProjectEntity,
    transactionalEntityManager: EntityManager,
  ): Promise<TeamEntity> {
    const team = transactionalEntityManager.create(TeamEntity, {
      description: PROJECT_DEFAULT_TEAM.description,
      isDefault: true,
      leaderId: project.ownerUserId,
      name: PROJECT_DEFAULT_TEAM.name,
      projectId: project.id,
      slug: PROJECT_DEFAULT_TEAM.slug,
    });

    return transactionalEntityManager.save(team);
  }

  private async findOrCreateDefaultRoles(
    transactionalEntityManager: EntityManager,
  ): Promise<DefaultProjectRoles> {
    const owner = await this.findOrCreateDefaultRole(
      PROJECT_DEFAULT_ROLES.owner,
      transactionalEntityManager,
    );
    const admin = await this.findOrCreateDefaultRole(
      PROJECT_DEFAULT_ROLES.admin,
      transactionalEntityManager,
    );
    const member = await this.findOrCreateDefaultRole(
      PROJECT_DEFAULT_ROLES.member,
      transactionalEntityManager,
    );

    return {
      admin,
      member,
      owner,
    };
  }

  private async findOrCreateDefaultRole(
    input: DefaultProjectRoleInput,
    transactionalEntityManager: EntityManager,
  ): Promise<RoleEntity> {
    const existingRole = await transactionalEntityManager.findOne(RoleEntity, {
      where: { key: input.key },
    });

    if (existingRole != null) {
      return existingRole;
    }

    const role = transactionalEntityManager.create(RoleEntity, {
      ...input,
      description: input.description ?? null,
    });

    return transactionalEntityManager.save(role);
  }

  private async findOrCreateDefaultPermissions(
    transactionalEntityManager: EntityManager,
  ): Promise<PermissionEntity[]> {
    const permissions: PermissionEntity[] = [];

    for (const permission of PROJECT_DEFAULT_PERMISSIONS) {
      permissions.push(
        await this.findOrCreateDefaultPermission(
          permission,
          transactionalEntityManager,
        ),
      );
    }

    return permissions;
  }

  private async findOrCreateDefaultPermission(
    input: DefaultProjectPermissionInput,
    transactionalEntityManager: EntityManager,
  ): Promise<PermissionEntity> {
    const existingPermission = await transactionalEntityManager.findOne(
      PermissionEntity,
      {
        where: { key: input.key },
      },
    );

    if (existingPermission != null) {
      return existingPermission;
    }

    const permission = transactionalEntityManager.create(PermissionEntity, {
      ...input,
      description: input.description ?? null,
    });

    return transactionalEntityManager.save(permission);
  }

  private async createDefaultRolePermissions(
    roles: DefaultProjectRoles,
    permissions: PermissionEntity[],
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    const permissionsByKey = new Map(
      permissions.map((permission) => [permission.key, permission]),
    );

    const rolePermissions = [
      {
        permissionKeys:
          PROJECT_DEFAULT_ROLE_PERMISSIONS[PROJECT_DEFAULT_ROLE_KEYS.owner],
        role: roles.owner,
      },
      {
        permissionKeys:
          PROJECT_DEFAULT_ROLE_PERMISSIONS[PROJECT_DEFAULT_ROLE_KEYS.admin],
        role: roles.admin,
      },
      {
        permissionKeys:
          PROJECT_DEFAULT_ROLE_PERMISSIONS[PROJECT_DEFAULT_ROLE_KEYS.member],
        role: roles.member,
      },
    ];

    for (const { permissionKeys, role } of rolePermissions) {
      for (const permissionKey of permissionKeys) {
        const permission = permissionsByKey.get(permissionKey);

        if (permission == null) {
          throw new Error(`Default permission ${permissionKey} was not found`);
        }

        await this.findOrCreateDefaultRolePermission(
          role.id,
          permission.id,
          transactionalEntityManager,
        );
      }
    }
  }

  private async findOrCreateDefaultRolePermission(
    roleId: number,
    permissionId: number,
    transactionalEntityManager: EntityManager,
  ): Promise<RolePermissionEntity> {
    const existingRolePermission = await transactionalEntityManager.findOne(
      RolePermissionEntity,
      {
        where: {
          permissionId,
          roleId,
        },
      },
    );

    if (existingRolePermission != null) {
      return existingRolePermission;
    }

    const rolePermission = transactionalEntityManager.create(
      RolePermissionEntity,
      {
        permissionId,
        roleId,
      },
    );

    return transactionalEntityManager.save(rolePermission);
  }

  private async createProjectOwnerMembership(
    project: ProjectEntity,
    transactionalEntityManager: EntityManager,
  ): Promise<ProjectMemberEntity> {
    const projectMember = transactionalEntityManager.create(
      ProjectMemberEntity,
      {
        invitedByUser: { id: project.ownerUserId } as never,
        invitedByUserId: project.ownerUserId,
        joinedAt: new Date(),
        project: { id: project.id } as never,
        projectId: project.id,
        status: ProjectMemberStatus.ACTIVE,
        user: { id: project.ownerUserId } as never,
        userId: project.ownerUserId,
      },
    );

    return transactionalEntityManager.save(projectMember);
  }

  private async createProjectOwnerRoleAssignment(
    project: ProjectEntity,
    ownerRole: RoleEntity,
    transactionalEntityManager: EntityManager,
  ): Promise<UserRoleAssignmentEntity> {
    const assignment = transactionalEntityManager.create(
      UserRoleAssignmentEntity,
      {
        assignedByUserId: project.ownerUserId,
        projectId: project.id,
        roleId: ownerRole.id,
        scopeType: RoleScopeType.PROJECT,
        teamId: null,
        userId: project.ownerUserId,
      },
    );

    return transactionalEntityManager.save(assignment);
  }
}
