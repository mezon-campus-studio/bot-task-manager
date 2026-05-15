import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { PROJECT_DEFAULT_ROLE_KEYS } from '@src/modules/project/constants';
import { ProjectService } from '@src/modules/project/project.service';
import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';
import RoleEntity from '@src/modules/role/role.entity';
import UserRoleAssignmentEntity from '@src/modules/user-role-assignment/user-role-assignment.entity';
import { ProjectMemberStatus } from './project-member-status.enum';
import { ProjectMemberService } from './project-member.service';

describe(ProjectMemberService.name, () => {
  let projectMemberService: ProjectMemberService;
  let projectService: ProjectService;
  let roleRepository: Repository<RoleEntity>;
  let userRoleAssignmentRepository: Repository<UserRoleAssignmentEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    const dataSource = testingModule!.get(DataSource);

    projectMemberService = testingModule!.get(ProjectMemberService);
    projectService = testingModule!.get(ProjectService);
    roleRepository = dataSource.getRepository(RoleEntity);
    userRoleAssignmentRepository = dataSource.getRepository(
      UserRoleAssignmentEntity,
    );
  });

  async function createProjectWithDefaults(slug: string) {
    const owner = await factory.user({
      mezonId: `${slug}-owner`,
    });

    const project = await projectService.createProject({
      name: slug.replaceAll('-', ' '),
      ownerUserId: owner.id,
      slug,
    });

    return {
      owner,
      project,
    };
  }

  it('finds a membership by internal id', async () => {
    const membership = await factory.projectMember({
      status: ProjectMemberStatus.ACTIVE,
    });

    await expect(
      projectMemberService.findById(membership.id),
    ).resolves.toMatchObject({
      id: membership.id,
      projectId: membership.projectId,
      userId: membership.userId,
    });
  });

  it('returns null when the membership id does not exist', async () => {
    await expect(projectMemberService.findById(999_999)).resolves.toBeNull();
  });

  it('finds a membership by project and user', async () => {
    const membership = await factory.projectMember({
      status: ProjectMemberStatus.ACTIVE,
    });

    await expect(
      projectMemberService.findByProjectAndUser(
        membership.projectId,
        membership.userId,
      ),
    ).resolves.toMatchObject({
      id: membership.id,
      status: ProjectMemberStatus.ACTIVE,
    });
  });

  it('returns null when the project membership has not been created yet', async () => {
    const project = await factory.project();
    const user = await factory.user();

    await expect(
      projectMemberService.findByProjectAndUser(project.id, user.id),
    ).resolves.toBeNull();
  });

  it('lists non-removed project memberships with user details', async () => {
    const project = await factory.project();
    const activeUser = await factory.user({
      mezonId: 'project-member-list-active-user',
      name: 'Active Member',
    });
    const invitedUser = await factory.user({
      mezonId: 'project-member-list-invited-user',
      name: 'Invited Member',
    });
    const removedUser = await factory.user({
      mezonId: 'project-member-list-removed-user',
      name: 'Removed Member',
    });

    const activeMembership = await factory.projectMember({
      projectId: project.id,
      status: ProjectMemberStatus.ACTIVE,
      userId: activeUser.id,
    });
    const invitedMembership = await factory.projectMember({
      projectId: project.id,
      status: ProjectMemberStatus.INVITED,
      userId: invitedUser.id,
    });
    await factory.projectMember({
      projectId: project.id,
      status: ProjectMemberStatus.REMOVED,
      userId: removedUser.id,
    });

    const memberships = await projectMemberService.listByProject(project.id);

    expect(memberships.map(({ id }) => id)).toEqual([
      activeMembership.id,
      invitedMembership.id,
    ]);
    expect(memberships.map(({ user }) => user.name)).toEqual([
      'Active Member',
      'Invited Member',
    ]);
  });

  it('upserts a project membership with invited defaults when optional fields are omitted', async () => {
    const project = await factory.project();
    const user = await factory.user();

    const membership = await projectMemberService.upsertMembership({
      projectId: project.id,
      userId: user.id,
    });

    expect(membership).toMatchObject({
      id: expect.any(Number),
      invitedByUserId: null,
      joinedAt: null,
      projectId: project.id,
      status: ProjectMemberStatus.INVITED,
      userId: user.id,
    });

    await expect(
      projectMemberService.findByProjectAndUser(project.id, user.id),
    ).resolves.toMatchObject({
      id: membership.id,
      status: ProjectMemberStatus.INVITED,
    });
  });

  it('updates an existing membership when the same project and user are upserted again', async () => {
    const project = await factory.project();
    const user = await factory.user();
    const inviter = await factory.user();
    const joinedAt = new Date('2026-04-19T12:00:00.000Z');

    const originalMembership = await factory.projectMember({
      projectId: project.id,
      status: ProjectMemberStatus.INVITED,
      userId: user.id,
    });

    const membership = await projectMemberService.upsertMembership({
      invitedByUserId: inviter.id,
      joinedAt,
      projectId: project.id,
      status: ProjectMemberStatus.ACTIVE,
      userId: user.id,
    });

    expect(membership).toMatchObject({
      id: originalMembership.id,
      invitedByUserId: inviter.id,
      joinedAt,
      projectId: project.id,
      status: ProjectMemberStatus.ACTIVE,
      userId: user.id,
    });
  });

  it('invites an existing user into a project and assigns the default project member role', async () => {
    const { project } = await createProjectWithDefaults(
      'project-member-invite-project',
    );
    const inviter = await factory.user({
      mezonId: 'project-member-invite-inviter',
    });
    const user = await factory.user({
      mezonId: 'project-member-invite-user',
    });

    const membership = await projectMemberService.inviteProjectMember({
      invitedByUserId: inviter.id,
      projectId: project.id,
      userId: user.id,
    });

    expect(membership).toMatchObject({
      invitedByUserId: inviter.id,
      joinedAt: null,
      projectId: project.id,
      status: ProjectMemberStatus.INVITED,
      userId: user.id,
    });

    const memberRole = await roleRepository.findOneByOrFail({
      key: PROJECT_DEFAULT_ROLE_KEYS.member,
    });

    await expect(
      userRoleAssignmentRepository.findOneByOrFail({
        projectId: project.id,
        roleId: memberRole.id,
        scopeType: RoleScopeType.PROJECT,
        teamId: IsNull(),
        userId: user.id,
      }),
    ).resolves.toMatchObject({
      assignedByUserId: inviter.id,
      projectId: project.id,
      roleId: memberRole.id,
      scopeType: RoleScopeType.PROJECT,
      teamId: null,
      userId: user.id,
    });
  });

  it('rejects inviting a user when the project does not exist', async () => {
    const user = await factory.user({
      mezonId: 'project-member-invite-missing-project-user',
    });

    await expect(
      projectMemberService.inviteProjectMember({
        projectId: 999_999,
        userId: user.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects inviting a user when the user does not exist', async () => {
    const { project } = await createProjectWithDefaults(
      'project-member-invite-missing-user-project',
    );

    await expect(
      projectMemberService.inviteProjectMember({
        projectId: project.id,
        userId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects inviting a user when the inviter does not exist', async () => {
    const { project } = await createProjectWithDefaults(
      'project-member-invite-missing-inviter-project',
    );
    const user = await factory.user({
      mezonId: 'project-member-invite-missing-inviter-user',
    });

    await expect(
      projectMemberService.inviteProjectMember({
        invitedByUserId: '22222222-2222-4222-8222-222222222222',
        projectId: project.id,
        userId: user.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects inviting a duplicate project member', async () => {
    const { project } = await createProjectWithDefaults(
      'project-member-invite-duplicate-project',
    );
    const user = await factory.user({
      mezonId: 'project-member-invite-duplicate-user',
    });

    await projectMemberService.inviteProjectMember({
      projectId: project.id,
      userId: user.id,
    });

    await expect(
      projectMemberService.inviteProjectMember({
        projectId: project.id,
        userId: user.id,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('re-invites a removed project member and restores the default project member role assignment', async () => {
    const { project } = await createProjectWithDefaults(
      'project-member-reinvite-project',
    );
    const inviter = await factory.user({
      mezonId: 'project-member-reinvite-inviter',
    });
    const user = await factory.user({
      mezonId: 'project-member-reinvite-user',
    });
    const membership = await projectMemberService.inviteProjectMember({
      projectId: project.id,
      userId: user.id,
    });

    await projectMemberService.removeProjectMember(project.id, user.id);

    const result = await projectMemberService.inviteProjectMember({
      invitedByUserId: inviter.id,
      projectId: project.id,
      userId: user.id,
    });

    expect(result).toMatchObject({
      id: membership.id,
      invitedByUserId: inviter.id,
      joinedAt: null,
      projectId: project.id,
      status: ProjectMemberStatus.INVITED,
      userId: user.id,
    });

    const memberRole = await roleRepository.findOneByOrFail({
      key: PROJECT_DEFAULT_ROLE_KEYS.member,
    });

    await expect(
      userRoleAssignmentRepository.findOneByOrFail({
        projectId: project.id,
        roleId: memberRole.id,
        scopeType: RoleScopeType.PROJECT,
        teamId: IsNull(),
        userId: user.id,
      }),
    ).resolves.toMatchObject({
      assignedByUserId: inviter.id,
      projectId: project.id,
      roleId: memberRole.id,
      scopeType: RoleScopeType.PROJECT,
      teamId: null,
      userId: user.id,
    });
  });

  it('removes a project member and clears the default project member role assignment', async () => {
    const { project } = await createProjectWithDefaults(
      'project-member-remove-project',
    );
    const user = await factory.user({
      mezonId: 'project-member-remove-user',
    });
    const membership = await projectMemberService.inviteProjectMember({
      projectId: project.id,
      userId: user.id,
    });
    const memberRole = await roleRepository.findOneByOrFail({
      key: PROJECT_DEFAULT_ROLE_KEYS.member,
    });

    await expect(
      projectMemberService.removeProjectMember(project.id, user.id),
    ).resolves.toBe(true);

    await expect(
      projectMemberService.findById(membership.id),
    ).resolves.toMatchObject({
      id: membership.id,
      projectId: project.id,
      status: ProjectMemberStatus.REMOVED,
      userId: user.id,
    });
    await expect(
      userRoleAssignmentRepository.findOneBy({
        projectId: project.id,
        roleId: memberRole.id,
        scopeType: RoleScopeType.PROJECT,
        teamId: IsNull(),
        userId: user.id,
      }),
    ).resolves.toBeNull();
  });

  it('returns false when removing a project member that does not exist', async () => {
    const { project } = await createProjectWithDefaults(
      'project-member-remove-missing-project',
    );
    const user = await factory.user({
      mezonId: 'project-member-remove-missing-user',
    });

    await expect(
      projectMemberService.removeProjectMember(project.id, user.id),
    ).resolves.toBe(false);
  });

  it('rejects removing the project owner from project members', async () => {
    const { owner, project } = await createProjectWithDefaults(
      'project-member-remove-owner-project',
    );

    await expect(
      projectMemberService.removeProjectMember(project.id, owner.id),
    ).rejects.toThrow(ConflictException);
  });
});
