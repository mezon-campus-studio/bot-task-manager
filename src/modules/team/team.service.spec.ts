import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { ProjectContextService } from '@src/modules/project/project-context.service';
import ProjectEntity from '@src/modules/project/project.entity';
import { ProjectOnboardingStatus } from '@src/modules/project/project.enums';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import ProjectMemberEntity from '@src/modules/project-member/project-member.entity';
import TaskEntity from '@src/modules/task/task.entity';
import { TeamMemberStatus } from '@src/modules/team-member/enums/team-member-status.enum';
import TeamMemberEntity from '@src/modules/team-member/team-member.entity';
import TeamEntity from './team.entity';
import { TeamService } from './team.service';

describe(TeamService.name, () => {
  let projectRepository: Repository<ProjectEntity>;
  let projectContextService: ProjectContextService;
  let teamService: TeamService;
  let taskRepository: Repository<TaskEntity>;
  let teamMemberRepository: Repository<TeamMemberEntity>;
  let teamRepository: Repository<TeamEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    projectRepository = testingModule!
      .get(DataSource)
      .getRepository(ProjectEntity);
    projectContextService = testingModule!.get(ProjectContextService);
    teamService = testingModule!.get(TeamService);
    taskRepository = testingModule!.get(DataSource).getRepository(TaskEntity);
    teamMemberRepository = testingModule!
      .get(DataSource)
      .getRepository(TeamMemberEntity);
    teamRepository = testingModule!.get(DataSource).getRepository(TeamEntity);
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

  async function createCurrentProjectContext(slug: string) {
    const owner = await factory.user({
      mezonId: `${slug}-owner`,
    });
    const user = await factory.user({
      mezonId: `${slug}-member`,
    });
    const project = await createProject(slug, owner.id);

    await factory.projectMember({
      projectId: project.id,
      status: ProjectMemberStatus.ACTIVE,
      userId: user.id,
    });
    await projectContextService.useProject({
      projectId: project.id,
      userId: user.id,
    });

    return {
      owner,
      project,
      user,
    };
  }

  describe('createTeam', () => {
    it('should persist a team with nullable metadata defaults when only the required fields are provided', async () => {
      const owner = await factory.user({
        mezonId: 'team-create-owner',
      });
      const project = await createProject('team-create-project', owner.id);

      const createdTeam = await teamService.createTeam({
        name: 'Platform',
        projectId: project.id,
        slug: 'platform',
        leaderId: owner.id,
      });

      expect(createdTeam).toMatchObject({
        createdBy: null,
        description: null,
        isDefault: false,
        name: 'Platform',
        projectId: project.id,
        slug: 'platform',
        leaderId: owner.id,
        updatedBy: null,
      });

      await expect(
        teamRepository.findOneByOrFail({ id: createdTeam.id }),
      ).resolves.toMatchObject({
        createdBy: null,
        description: null,
        isDefault: false,
        name: 'Platform',
        projectId: project.id,
        slug: 'platform',
        leaderId: owner.id,
        updatedBy: null,
      });
    });

    it('should reject creating a second team with the same slug inside the same project', async () => {
      const owner = await factory.user({
        mezonId: 'team-duplicate-owner',
      });
      const project = await createProject('team-duplicate-project', owner.id);

      await factory.team({
        name: 'Platform',
        projectId: project.id,
        slug: 'platform',
      });

      await expect(
        teamService.createTeam({
          name: 'Platform Copy',
          projectId: project.id,
          slug: 'platform',
          leaderId: owner.id,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should deactivate old default team when a new default team is created', async () => {
      const owner = await factory.user({ mezonId: 'owner-3' });
      const project = await createProject('project-3', owner.id);

      const oldDefault = await factory.team({
        projectId: project.id,
        isDefault: true,
        slug: 'old-default',
      });

      const newTeam = await teamService.createTeam({
        name: 'New Default',
        projectId: project.id,
        slug: 'new-default',
        leaderId: owner.id,
        isDefault: true,
      });

      const updatedOldDefault = await teamRepository.findOneBy({
        id: oldDefault.id,
      });
      expect(updatedOldDefault?.isDefault).toBe(false);
      expect(newTeam.isDefault).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return the persisted team when the id exists', async () => {
      const owner = await factory.user({
        mezonId: 'team-find-owner',
      });
      const project = await createProject('team-find-project', owner.id);
      const team = await factory.team({
        projectId: project.id,
        slug: 'team-find-by-id',
      });

      await expect(teamService.findById(team.id)).resolves.toMatchObject({
        id: team.id,
        slug: 'team-find-by-id',
      });
    });

    it('should return null when the team id does not exist', async () => {
      await expect(teamService.findById(999_999)).resolves.toBeNull();
    });
  });

  describe('findByProjectId', () => {
    it('should list only teams for the requested project in ascending id order', async () => {
      const owner = await factory.user({
        mezonId: 'team-list-owner',
      });
      const project = await createProject('team-list-project', owner.id);
      const firstTeam = await factory.team({
        projectId: project.id,
        slug: 'alpha-team',
      });
      const secondTeam = await factory.team({
        projectId: project.id,
        slug: 'beta-team',
      });

      const otherOwner = await factory.user({
        mezonId: 'team-list-other-owner',
      });
      const otherProject = await createProject(
        'team-list-other-project',
        otherOwner.id,
      );

      await factory.team({
        projectId: otherProject.id,
        slug: 'outside-team',
      });

      const teams = await teamService.findByProjectId(project.id);

      expect(teams.map((team) => team.id)).toEqual([
        firstTeam.id,
        secondTeam.id,
      ]);
    });
  });

  describe('findByProjectAndSlug', () => {
    it('should return null when the slug belongs to a different project', async () => {
      const foreignOwner = await factory.user({
        mezonId: 'team-foreign-owner',
      });
      const foreignProject = await createProject(
        'team-foreign-project',
        foreignOwner.id,
      );

      await factory.team({
        projectId: foreignProject.id,
        slug: 'shared-slug',
      });

      const requestedOwner = await factory.user({
        mezonId: 'team-requested-owner',
      });
      const requestedProject = await createProject(
        'team-requested-project',
        requestedOwner.id,
      );

      await expect(
        teamService.findByProjectAndSlug(requestedProject.id, 'shared-slug'),
      ).resolves.toBeNull();
    });

    it('should return the team when both the project and slug match', async () => {
      const owner = await factory.user({
        mezonId: 'team-match-owner',
      });
      const project = await createProject('team-match-project', owner.id);
      const team = await factory.team({
        projectId: project.id,
        slug: 'design-team',
      });

      await expect(
        teamService.findByProjectAndSlug(project.id, 'design-team'),
      ).resolves.toMatchObject({
        id: team.id,
        projectId: project.id,
        slug: 'design-team',
      });
    });
  });

  describe('findByLeaderId', () => {
    it('should return a list of teams led by the specified user', async () => {
      const leader = await factory.user({ mezonId: 'leader-1' });
      const project = await createProject('leader-project', leader.id);

      await factory.team({
        projectId: project.id,
        leaderId: leader.id,
        slug: 'team-1',
      });
      await factory.team({
        projectId: project.id,
        leaderId: leader.id,
        slug: 'team-2',
      });

      const teams = await teamService.findByLeaderId(leader.id);

      expect(teams).toHaveLength(2);
      expect(teams.every((t) => t.leaderId === leader.id)).toBe(true);
    });
  });

  describe('findDefaultTeamByProjectId', () => {
    it('should return the default team of the project', async () => {
      const owner = await factory.user();
      const project = await createProject('p-find-default', owner.id);
      await factory.team({
        projectId: project.id,
        isDefault: true,
        slug: 'the-default',
      });
      await factory.team({
        projectId: project.id,
        isDefault: false,
        slug: 'not-default',
      });

      const team = await teamService.findDefaultTeamByProjectId(project.id);

      expect(team).not.toBeNull();
      expect(team?.slug).toBe('the-default');
      expect(team?.isDefault).toBe(true);
    });
  });

  describe('current project team flow', () => {
    it('should reject team current project operations when the user has not selected a project', async () => {
      const user = await factory.user({
        mezonId: 'team-current-missing-context-user',
      });

      await expect(
        projectContextService.getRequiredCurrentProject(user.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject team current project operations when the selected member was removed', async () => {
      const { project, user } = await createCurrentProjectContext(
        'team-current-removed-member-project',
      );

      await testingModule!
        .get(DataSource)
        .getRepository(ProjectMemberEntity)
        .update(
          { projectId: project.id, userId: user.id },
          { status: ProjectMemberStatus.REMOVED },
        );

      await expect(
        projectContextService.getRequiredCurrentProject(user.id),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        projectContextService.getRequiredCurrentProjectByMezonId(user.mezonId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a team inside the selected current project', async () => {
      const { project, user } = await createCurrentProjectContext(
        'team-current-create-project',
      );
      const context = await projectContextService.getRequiredCurrentProject(
        user.id,
      );

      const team = await teamService.createTeamInProject(context.projectId, {
        leaderId: user.id,
        name: 'Current Project Team',
        slug: 'current-project-team',
      });

      expect(team).toMatchObject({
        leaderId: user.id,
        name: 'Current Project Team',
        projectId: project.id,
        slug: 'current-project-team',
      });
    });

    it('should list only teams from the selected current project', async () => {
      const { project, user } = await createCurrentProjectContext(
        'team-current-scope-project',
      );
      const otherOwner = await factory.user({
        mezonId: 'team-current-scope-other-owner',
      });
      const otherProject = await createProject(
        'team-current-scope-other-project',
        otherOwner.id,
      );

      const currentTeam = await factory.team({
        projectId: project.id,
        slug: 'current-scope-team',
      });

      await factory.team({
        projectId: otherProject.id,
        slug: 'other-scope-team',
      });

      const context = await projectContextService.getRequiredCurrentProject(
        user.id,
      );
      const teams = await teamService.findByProjectId(context.projectId);

      expect(teams.map(({ id }) => id)).toEqual([currentTeam.id]);
    });

    it('should assign an existing team to the selected current project', async () => {
      const { project, user } = await createCurrentProjectContext(
        'team-current-assign-project',
      );
      const sourceOwner = await factory.user({
        mezonId: 'team-current-assign-source-owner',
      });
      const sourceProject = await createProject(
        'team-current-assign-source-project',
        sourceOwner.id,
      );
      const team = await factory.team({
        isDefault: true,
        projectId: sourceProject.id,
        slug: 'assignable-team',
      });
      const sourceTask = await factory.task({
        projectId: sourceProject.id,
        reporterUserId: sourceOwner.id,
        teamId: team.id,
        title: 'Source task should lose moved team mapping',
      });
      const context = await projectContextService.getRequiredCurrentProject(
        user.id,
      );

      const result = await teamService.assignTeamToProject(
        context.projectId,
        team.id,
      );

      expect(result).toMatchObject({
        id: team.id,
        isDefault: false,
        projectId: project.id,
      });
      await expect(
        taskRepository.findOneByOrFail({ id: sourceTask.id }),
      ).resolves.toMatchObject({
        id: sourceTask.id,
        teamId: null,
      });
    });

    it('should delete a team from current project and cleanup team members and task mapping', async () => {
      const { project, user } = await createCurrentProjectContext(
        'team-current-delete-project',
      );
      const team = await factory.team({
        projectId: project.id,
        slug: 'delete-current-team',
      });
      const membership = await factory.teamMember({
        status: TeamMemberStatus.ACTIVE,
        teamId: team.id,
        userId: user.id,
      });
      const task = await factory.task({
        projectId: project.id,
        reporterUserId: user.id,
        teamId: team.id,
        title: 'Cleanup team task mapping',
      });
      const context = await projectContextService.getRequiredCurrentProject(
        user.id,
      );

      await teamService.deleteTeamFromProject(context.projectId, team.id);

      await expect(
        teamRepository.findOne({
          where: { id: team.id },
          withDeleted: true,
        }),
      ).resolves.toMatchObject({
        deletedAt: expect.any(Date),
        id: team.id,
      });
      await expect(
        teamMemberRepository.findOne({
          where: { id: membership.id },
          withDeleted: true,
        }),
      ).resolves.toMatchObject({
        deletedAt: expect.any(Date),
        id: membership.id,
      });
      await expect(
        taskRepository.findOneByOrFail({ id: task.id }),
      ).resolves.toMatchObject({
        id: task.id,
        teamId: null,
      });
    });

    it('should reject deleting a team that does not belong to the selected current project', async () => {
      const { user } = await createCurrentProjectContext(
        'team-current-delete-mismatch-project',
      );
      const otherOwner = await factory.user({
        mezonId: 'team-current-delete-mismatch-owner',
      });
      const otherProject = await createProject(
        'team-current-delete-mismatch-other-project',
        otherOwner.id,
      );
      const otherTeam = await factory.team({
        projectId: otherProject.id,
        slug: 'other-delete-team',
      });
      const context = await projectContextService.getRequiredCurrentProject(
        user.id,
      );

      await expect(
        teamService.deleteTeamFromProject(context.projectId, otherTeam.id),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateTeam', () => {
    it('should successfully update team information', async () => {
      const owner = await factory.user();
      const project = await createProject('p-update', owner.id);
      const team = await factory.team({
        projectId: project.id,
        name: 'Old Name',
      });

      const updated = await teamService.updateTeam(team.id, {
        name: 'New Name',
      });
      expect(updated.name).toBe('New Name');
    });

    it('should throw ConflictException if updated name conflicts with another team', async () => {
      const owner = await factory.user();
      const project = await createProject('p-conflict', owner.id);
      await factory.team({ projectId: project.id, name: 'Existing' });
      const myTeam = await factory.team({
        projectId: project.id,
        name: 'My Team',
      });

      await expect(
        teamService.updateTeam(myTeam.id, { name: 'Existing' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should deactivate the old default team when an existing team is updated to be the new default', async () => {
      const owner = await factory.user();
      const project = await createProject('p-update-default-logic', owner.id);

      const oldDefault = await factory.team({
        projectId: project.id,
        isDefault: true,
        slug: 'old-default',
      });
      const targetTeam = await factory.team({
        projectId: project.id,
        isDefault: false,
        slug: 'target-team',
      });

      await teamService.updateTeam(targetTeam.id, { isDefault: true });

      const updatedOldDefault = await teamRepository.findOneBy({
        id: oldDefault.id,
      });
      const updatedTarget = await teamRepository.findOneBy({
        id: targetTeam.id,
      });

      expect(updatedOldDefault?.isDefault).toBe(false);
      expect(updatedTarget?.isDefault).toBe(true);
    });
  });

  describe('softDelete', () => {
    it('should perform soft delete successfully', async () => {
      const owner = await factory.user();
      const project = await createProject('p-delete', owner.id);
      const team = await factory.team({ projectId: project.id });

      await teamService.softDelete(team.id);

      const found = await teamRepository.findOne({ where: { id: team.id } });
      expect(found).toBeNull();
    });

    it('should throw NotFoundException when deleting non-existent team', async () => {
      await expect(teamService.softDelete(99999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should verify the record still exists in the database with a deletedAt timestamp after soft delete', async () => {
      const owner = await factory.user();
      const project = await createProject('p-soft-delete-verify', owner.id);
      const team = await factory.team({ projectId: project.id });

      await teamService.softDelete(team.id);

      const deletedTeam = await teamRepository.findOne({
        where: { id: team.id },
        withDeleted: true,
      });

      expect(deletedTeam).not.toBeNull();
      expect(deletedTeam?.deletedAt).toBeInstanceOf(Date);
    });
  });
});
