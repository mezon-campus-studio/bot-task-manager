import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import ProjectEntity from '@src/modules/project/project.entity';
import { ProjectOnboardingStatus } from '@src/modules/project/project.enums';
import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';
import UserRoleAssignmentEntity from './user-role-assignment.entity';
import { UserRoleAssignmentService } from './user-role-assignment.service';
import { use } from 'passport';

describe(UserRoleAssignmentService.name, () => {
  let projectRepository: Repository<ProjectEntity>;
  let userRoleAssignmentService: UserRoleAssignmentService;
  let userRoleAssignmentRepository: Repository<UserRoleAssignmentEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    projectRepository = testingModule!
      .get(DataSource)
      .getRepository(ProjectEntity);
    userRoleAssignmentService = testingModule!.get(UserRoleAssignmentService);
    userRoleAssignmentRepository = testingModule!
      .get(DataSource)
      .getRepository(UserRoleAssignmentEntity);
  });

  async function createProject(slug: string, ownerUserId: string) {
    const project = projectRepository.create({
      name: slug.replaceAll('-', ' '),
      onboardingStatus: ProjectOnboardingStatus.PENDING,
      ownerUser: { id: ownerUserId } as never,
      ownerUserId,
      slug,
    });

    return projectRepository.save(project);
  }

  describe('createAssignment', () => {
    it('should persist a system assignment with nullable scope metadata by default', async () => {
      const user = await factory.user({
        mezonId: 'user-role-assignment-system-user',
      });
      const role = await factory.role({
        key: 'user-role-assignment-system-role',
        scopeType: RoleScopeType.SYSTEM,
      });

      const assignment = await userRoleAssignmentService.createAssignment({
        roleId: role.id,
        scopeType: RoleScopeType.SYSTEM,
        userId: user.id,
      });

      expect(assignment).toMatchObject({
        assignedByUserId: null,
        projectId: null,
        roleId: role.id,
        scopeType: RoleScopeType.SYSTEM,
        teamId: null,
        userId: user.id,
      });

      await expect(
        userRoleAssignmentRepository.findOneByOrFail({ id: assignment.id }),
      ).resolves.toMatchObject({
        assignedByUserId: null,
        projectId: null,
        roleId: role.id,
        scopeType: RoleScopeType.SYSTEM,
        teamId: null,
        userId: user.id,
      });
    });

    it('should reject a project assignment when the project scope id is missing', async () => {
      const user = await factory.user({
        mezonId: 'user-role-assignment-invalid-user',
      });
      const role = await factory.role({
        key: 'user-role-assignment-invalid-role',
        scopeType: RoleScopeType.PROJECT,
      });

      await expect(
        userRoleAssignmentService.createAssignment({
          roleId: role.id,
          scopeType: RoleScopeType.PROJECT,
          userId: user.id,
        }),
      ).rejects.toThrow();
    });

    it('should reject duplicate assignment for the same user, role, and scope', async () => {
      const user = await factory.user({
        mezonId: 'user-role-assignment-invalid-team-user',
      });
      const role = await factory.role({
        key: 'user-role-assignment-invalid-team-role',
        scopeType: RoleScopeType.SYSTEM,
      });

      await userRoleAssignmentService.createAssignment({
        roleId: role.id,
        scopeType: RoleScopeType.SYSTEM,
        userId: user.id,
      });

      await expect(
        userRoleAssignmentService.createAssignment({
          roleId: role.id,
          scopeType: RoleScopeType.SYSTEM,
          userId: user.id,
        }),
      ).rejects.toThrow();
    });
  });

  describe('findAssignments', () => {
    it('should filter assignments by user, role, scope, and project id', async () => {
      const user = await factory.user({
        mezonId: 'user-role-assignment-filter-user',
      });
      const projectOwner = await factory.user({
        mezonId: 'user-role-assignment-filter-owner',
      });
      const project = await createProject(
        'user-role-assignment-filter-project',
        projectOwner.id,
      );
      const matchingRole = await factory.role({
        key: 'user-role-assignment-filter-role',
        scopeType: RoleScopeType.PROJECT,
      });
      const otherRole = await factory.role({
        key: 'user-role-assignment-filter-other-role',
        scopeType: RoleScopeType.PROJECT,
      });
      const matchingAssignment = await factory.userRoleAssignment({
        projectId: project.id,
        roleId: matchingRole.id,
        scopeType: RoleScopeType.PROJECT,
        userId: user.id,
      });

      await factory.userRoleAssignment({
        projectId: project.id,
        roleId: otherRole.id,
        scopeType: RoleScopeType.PROJECT,
        userId: user.id,
      });

      const otherProjectOwner = await factory.user({
        mezonId: 'user-role-assignment-other-owner',
      });
      const otherProject = await createProject(
        'user-role-assignment-other-project',
        otherProjectOwner.id,
      );

      await factory.userRoleAssignment({
        projectId: otherProject.id,
        roleId: matchingRole.id,
        scopeType: RoleScopeType.PROJECT,
        userId: user.id,
      });

      const assignments = await userRoleAssignmentService.findAssignments({
        projectId: project.id,
        roleId: matchingRole.id,
        scopeType: RoleScopeType.PROJECT,
        userId: user.id,
      });

      expect(assignments).toEqual([
        expect.objectContaining({
          id: matchingAssignment.id,
          projectId: project.id,
          roleId: matchingRole.id,
          scopeType: RoleScopeType.PROJECT,
          userId: user.id,
        }),
      ]);
    });

    it('should translate null scope filters into null project and team matches', async () => {
      const user = await factory.user({
        mezonId: 'user-role-assignment-null-user',
      });
      const systemRole = await factory.role({
        key: 'user-role-assignment-null-system-role',
        scopeType: RoleScopeType.SYSTEM,
      });
      const systemAssignment = await factory.userRoleAssignment({
        projectId: null,
        roleId: systemRole.id,
        scopeType: RoleScopeType.SYSTEM,
        teamId: null,
        userId: user.id,
      });

      const projectOwner = await factory.user({
        mezonId: 'user-role-assignment-null-owner',
      });
      const project = await createProject(
        'user-role-assignment-null-project',
        projectOwner.id,
      );

      await factory.userRoleAssignment({
        projectId: project.id,
        roleId: (
          await factory.role({
            key: 'user-role-assignment-null-project-role',
            scopeType: RoleScopeType.PROJECT,
          })
        ).id,
        scopeType: RoleScopeType.PROJECT,
        userId: user.id,
      });

      const teamOwner = await factory.user({
        mezonId: 'user-role-assignment-null-team-owner',
      });
      const teamProject = await createProject(
        'user-role-assignment-null-team-project',
        teamOwner.id,
      );
      const team = await factory.team({
        projectId: teamProject.id,
        slug: 'user-role-assignment-null-team',
      });

      await factory.userRoleAssignment({
        roleId: (
          await factory.role({
            key: 'user-role-assignment-null-team-role',
            scopeType: RoleScopeType.TEAM,
          })
        ).id,
        scopeType: RoleScopeType.TEAM,
        teamId: team.id,
        userId: user.id,
      });

      const assignments = await userRoleAssignmentService.findAssignments({
        projectId: null,
        teamId: null,
        userId: user.id,
      });

      expect(assignments).toEqual([
        expect.objectContaining({
          id: systemAssignment.id,
          projectId: null,
          scopeType: RoleScopeType.SYSTEM,
          teamId: null,
          userId: user.id,
        }),
      ]);
    });
  });

  describe('findByUserId', () => {
    it('should list assignments for one user in ascending id order', async () => {
      const user = await factory.user({
        mezonId: 'user-role-assignment-list-user',
      });
      const firstAssignment = await factory.userRoleAssignment({
        roleId: (
          await factory.role({
            key: 'user-role-assignment-list-system-role',
            scopeType: RoleScopeType.SYSTEM,
          })
        ).id,
        scopeType: RoleScopeType.SYSTEM,
        userId: user.id,
      });

      const projectOwner = await factory.user({
        mezonId: 'user-role-assignment-list-owner',
      });
      const project = await createProject(
        'user-role-assignment-list-project',
        projectOwner.id,
      );
      const secondAssignment = await factory.userRoleAssignment({
        projectId: project.id,
        roleId: (
          await factory.role({
            key: 'user-role-assignment-list-project-role',
            scopeType: RoleScopeType.PROJECT,
          })
        ).id,
        scopeType: RoleScopeType.PROJECT,
        userId: user.id,
      });

      await factory.userRoleAssignment({
        roleId: (
          await factory.role({
            key: 'user-role-assignment-list-other-role',
            scopeType: RoleScopeType.SYSTEM,
          })
        ).id,
        scopeType: RoleScopeType.SYSTEM,
        userId: (
          await factory.user({
            mezonId: 'user-role-assignment-list-other-user',
          })
        ).id,
      });

      const assignments = await userRoleAssignmentService.findByUserId(user.id);

      expect(assignments.map((assignment) => assignment.id)).toEqual([
        firstAssignment.id,
        secondAssignment.id,
      ]);
    });
  });

  describe('removeAssignment', () => {
    it('should remove an assignment by id', async () => {
      const user = await factory.user({
        mezonId: 'user-role-assignment-remove-user',
      });
      const role = await factory.role({
        key: 'user-role-assignment-remove-role',
        scopeType: RoleScopeType.SYSTEM,
      });
      const assignment = await factory.userRoleAssignment({
        roleId: role.id,
        scopeType: RoleScopeType.SYSTEM,
        userId: user.id,
      });

      await userRoleAssignmentService.removeAssignment(assignment.id);

      await expect(
        userRoleAssignmentRepository.findOneByOrFail({ id: assignment.id }),
      ).rejects.toThrow();
    });

    it('should throw when trying to remove a non-existent assignment', async () => {
      await expect(
        userRoleAssignmentService.removeAssignment(-1),
      ).rejects.toThrow();
    });
  });
});
