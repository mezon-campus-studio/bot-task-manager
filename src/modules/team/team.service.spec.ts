import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import ProjectEntity from '@src/modules/project/project.entity';
import { ProjectOnboardingStatus } from '@src/modules/project/project.enums';
import TeamEntity from './team.entity';
import { TeamService } from './team.service';

describe(TeamService.name, () => {
  let projectRepository: Repository<ProjectEntity>;
  let teamService: TeamService;
  let teamRepository: Repository<TeamEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    projectRepository = testingModule!
      .get(DataSource)
      .getRepository(ProjectEntity);
    teamService = testingModule!.get(TeamService);
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
      });

      expect(createdTeam).toMatchObject({
        createdBy: null,
        description: null,
        isDefault: false,
        name: 'Platform',
        projectId: project.id,
        slug: 'platform',
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
        }),
      ).rejects.toThrow();
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
});
