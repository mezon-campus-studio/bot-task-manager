import { ConflictException } from '@nestjs/common';
import { DataSource, In, IsNull, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import PermissionEntity from '@src/modules/permission/permission.entity';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import ProjectMemberEntity from '@src/modules/project-member/project-member.entity';
import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';
import RoleEntity from '@src/modules/role/role.entity';
import RolePermissionEntity from '@src/modules/role-permission/role-permission.entity';
import TeamEntity from '@src/modules/team/team.entity';
import { TeamMemberStatus } from '@src/modules/team-member/enums/team-member-status.enum';
import UserRoleAssignmentEntity from '@src/modules/user-role-assignment/user-role-assignment.entity';
import {
  PROJECT_DEFAULT_PERMISSIONS,
  PROJECT_DEFAULT_ROLE_KEYS,
  PROJECT_DEFAULT_TEAM,
} from './constants';
import { ProjectOnboardingStatus } from './project.enums';
import { ProjectService } from './project.service';

describe(ProjectService.name, () => {
  let permissionRepository: Repository<PermissionEntity>;
  let projectMemberRepository: Repository<ProjectMemberEntity>;
  let projectService: ProjectService;
  let rolePermissionRepository: Repository<RolePermissionEntity>;
  let roleRepository: Repository<RoleEntity>;
  let teamRepository: Repository<TeamEntity>;
  let userRoleAssignmentRepository: Repository<UserRoleAssignmentEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    const dataSource = testingModule!.get(DataSource);

    permissionRepository = dataSource.getRepository(PermissionEntity);
    projectMemberRepository = dataSource.getRepository(ProjectMemberEntity);
    projectService = testingModule!.get(ProjectService);
    rolePermissionRepository = dataSource.getRepository(RolePermissionEntity);
    roleRepository = dataSource.getRepository(RoleEntity);
    teamRepository = dataSource.getRepository(TeamEntity);
    userRoleAssignmentRepository = dataSource.getRepository(
      UserRoleAssignmentEntity,
    );
  });

  it('creates a project with completed onboarding defaults when optional fields are omitted', async () => {
    const owner = await factory.user({
      email: 'project-owner-alpha@example.com',
      mezonId: 'project-owner-alpha',
      name: 'Project Owner Alpha',
    });

    const project = await projectService.createProject({
      name: 'Campus Alpha',
      ownerUserId: owner.id,
      slug: 'campus-alpha',
    });

    expect(project).toMatchObject({
      id: expect.any(Number),
      description: null,
      name: 'Campus Alpha',
      onboardingCompletedAt: expect.any(Date),
      onboardingStatus: ProjectOnboardingStatus.COMPLETED,
      ownerUserId: owner.id,
      slug: 'campus-alpha',
    });
  });

  it('initializes default project data after creating a project', async () => {
    const owner = await factory.user({
      email: 'project-owner-beta@example.com',
      mezonId: 'project-owner-beta',
      name: 'Project Owner Beta',
    });

    const project = await projectService.createProject({
      description: 'Initial project brief',
      name: 'Campus Beta',
      ownerUserId: owner.id,
      slug: 'campus-beta',
    });

    await expect(
      teamRepository.findOneByOrFail({
        isDefault: true,
        projectId: project.id,
        slug: PROJECT_DEFAULT_TEAM.slug,
      }),
    ).resolves.toMatchObject({
      description: PROJECT_DEFAULT_TEAM.description,
      isDefault: true,
      leaderId: owner.id,
      name: PROJECT_DEFAULT_TEAM.name,
      projectId: project.id,
      slug: PROJECT_DEFAULT_TEAM.slug,
    });

    const roles = await roleRepository.find({
      where: {
        key: In(Object.values(PROJECT_DEFAULT_ROLE_KEYS)),
      },
      order: {
        key: 'ASC',
      },
    });
    const permissions = await permissionRepository.find({
      where: {
        key: In(PROJECT_DEFAULT_PERMISSIONS.map(({ key }) => key)),
      },
    });

    expect(roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isSystem: true,
          key: PROJECT_DEFAULT_ROLE_KEYS.owner,
          scopeType: RoleScopeType.PROJECT,
        }),
        expect.objectContaining({
          isSystem: true,
          key: PROJECT_DEFAULT_ROLE_KEYS.admin,
          scopeType: RoleScopeType.PROJECT,
        }),
        expect.objectContaining({
          isSystem: true,
          key: PROJECT_DEFAULT_ROLE_KEYS.member,
          scopeType: RoleScopeType.PROJECT,
        }),
      ]),
    );
    expect(permissions).toEqual(
      expect.arrayContaining(
        PROJECT_DEFAULT_PERMISSIONS.map((permission) =>
          expect.objectContaining(permission),
        ),
      ),
    );

    const rolePermissionCount = await rolePermissionRepository.count({
      where: {
        roleId: In(roles.map(({ id }) => id)),
        permissionId: In(permissions.map(({ id }) => id)),
      },
    });

    expect(rolePermissionCount).toBe(8);

    await expect(
      projectMemberRepository.findOneByOrFail({
        projectId: project.id,
        userId: owner.id,
      }),
    ).resolves.toMatchObject({
      invitedByUserId: owner.id,
      projectId: project.id,
      status: ProjectMemberStatus.ACTIVE,
      userId: owner.id,
    });

    const ownerRole = roles.find(
      ({ key }) => key === PROJECT_DEFAULT_ROLE_KEYS.owner,
    )!;

    await expect(
      userRoleAssignmentRepository.findOneByOrFail({
        projectId: project.id,
        roleId: ownerRole.id,
        scopeType: RoleScopeType.PROJECT,
        teamId: IsNull(),
        userId: owner.id,
      }),
    ).resolves.toMatchObject({
      assignedByUserId: owner.id,
      projectId: project.id,
      roleId: ownerRole.id,
      scopeType: RoleScopeType.PROJECT,
      teamId: null,
      userId: owner.id,
    });
  });

  it('rejects creating a project with an existing slug', async () => {
    const owner = await factory.user({
      email: 'project-owner-duplicate@example.com',
      mezonId: 'project-owner-duplicate',
      name: 'Project Owner Duplicate',
    });

    await projectService.createProject({
      name: 'Campus Duplicate',
      ownerUserId: owner.id,
      slug: 'campus-duplicate',
    });

    await expect(
      projectService.createProject({
        name: 'Campus Duplicate Copy',
        ownerUserId: owner.id,
        slug: 'campus-duplicate',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('finds a project by internal id', async () => {
    const project = await factory.project({
      name: 'Campus Gamma',
      slug: 'campus-gamma',
    });

    await expect(projectService.findById(project.id)).resolves.toMatchObject({
      id: project.id,
      slug: 'campus-gamma',
    });
  });

  it('returns null when a project id does not exist', async () => {
    await expect(projectService.findById(999_999)).resolves.toBeNull();
  });

  it('finds a project by slug', async () => {
    const project = await factory.project({
      name: 'Campus Delta',
      slug: 'campus-delta',
    });

    await expect(
      projectService.findBySlug('campus-delta'),
    ).resolves.toMatchObject({
      id: project.id,
      slug: 'campus-delta',
    });
  });

  it('returns null when the slug is still available', async () => {
    await expect(
      projectService.findBySlug('missing-campus'),
    ).resolves.toBeNull();
  });

  it('lists projects ordered by newest id first', async () => {
    const firstProject = await factory.project({
      name: 'Campus List First',
      slug: 'campus-list-first',
    });
    const secondProject = await factory.project({
      name: 'Campus List Second',
      slug: 'campus-list-second',
    });

    const projects = await projectService.listProjects();
    const projectIds = projects.map(({ id }) => id);

    expect(projectIds).toEqual(
      expect.arrayContaining([firstProject.id, secondProject.id]),
    );
    expect(projectIds.indexOf(secondProject.id)).toBeLessThan(
      projectIds.indexOf(firstProject.id),
    );
  });

  it('lists projects accessible through ownership, project membership, or team membership', async () => {
    const owner = await factory.user({
      mezonId: 'project-access-owner',
    });
    const user = await factory.user({
      mezonId: 'project-access-user',
    });

    const ownedProject = await factory.project({
      ownerUserId: user.id,
      slug: 'project-access-owned',
    });
    const projectMemberProject = await factory.project({
      ownerUserId: owner.id,
      slug: 'project-access-project-member',
    });
    const teamMemberProject = await factory.project({
      ownerUserId: owner.id,
      slug: 'project-access-team-member',
    });
    const inaccessibleProject = await factory.project({
      ownerUserId: owner.id,
      slug: 'project-access-inaccessible',
    });

    await factory.projectMember({
      projectId: projectMemberProject.id,
      status: ProjectMemberStatus.ACTIVE,
      userId: user.id,
    });

    const team = await factory.team({
      projectId: teamMemberProject.id,
      slug: 'project-access-team',
    });
    await factory.teamMember({
      status: TeamMemberStatus.ACTIVE,
      teamId: team.id,
      userId: user.id,
    });

    const projects = await projectService.listAccessibleProjectsForUser(
      user.id,
    );
    const projectIds = projects.map(({ id }) => id);

    expect(projectIds).toEqual(
      expect.arrayContaining([
        ownedProject.id,
        projectMemberProject.id,
        teamMemberProject.id,
      ]),
    );
    expect(projectIds).not.toContain(inaccessibleProject.id);
  });

  it('updates an existing project with the provided changes', async () => {
    const project = await factory.project({
      description: 'Initial project description',
      name: 'Campus Update',
      slug: 'campus-update',
    });

    const updatedProject = await projectService.updateProject(project.id, {
      description: 'Updated project description',
      name: 'Campus Update Final',
      onboardingStatus: ProjectOnboardingStatus.IN_PROGRESS,
      slug: 'campus-update-final',
    });

    expect(updatedProject).toMatchObject({
      description: 'Updated project description',
      id: project.id,
      name: 'Campus Update Final',
      onboardingStatus: ProjectOnboardingStatus.IN_PROGRESS,
      slug: 'campus-update-final',
    });

    await expect(projectService.findById(project.id)).resolves.toMatchObject({
      description: 'Updated project description',
      id: project.id,
      name: 'Campus Update Final',
      slug: 'campus-update-final',
    });
  });

  it('rejects updating a project to an existing slug', async () => {
    await factory.project({
      name: 'Campus Existing Slug',
      slug: 'campus-existing-slug',
    });
    const project = await factory.project({
      name: 'Campus Target Slug',
      slug: 'campus-target-slug',
    });

    await expect(
      projectService.updateProject(project.id, {
        slug: 'campus-existing-slug',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns null when updating a missing project', async () => {
    await expect(
      projectService.updateProject(999_999, {
        name: 'Missing Campus',
      }),
    ).resolves.toBeNull();
  });

  it('soft deletes an existing project', async () => {
    const project = await factory.project({
      name: 'Campus Delete',
      slug: 'campus-delete',
    });

    await expect(projectService.deleteProject(project.id)).resolves.toBe(true);
    await expect(projectService.findById(project.id)).resolves.toBeNull();
  });

  it('returns false when deleting a missing project', async () => {
    await expect(projectService.deleteProject(999_999)).resolves.toBe(false);
  });
});
