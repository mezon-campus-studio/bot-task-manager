import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import ProjectEntity from '@src/modules/project/project.entity';
import { ProjectOnboardingStatus } from '@src/modules/project/project.enums';
import { TeamMemberStatus } from './enums/team-member-status.enum';
import TeamMemberEntity from './team-member.entity';
import { TeamMemberService } from './team-member.service';

describe(TeamMemberService.name, () => {
  let projectRepository: Repository<ProjectEntity>;
  let teamMemberService: TeamMemberService;
  let teamMemberRepository: Repository<TeamMemberEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    projectRepository = testingModule!
      .get(DataSource)
      .getRepository(ProjectEntity);
    teamMemberService = testingModule!.get(TeamMemberService);
    teamMemberRepository = testingModule!
      .get(DataSource)
      .getRepository(TeamMemberEntity);
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

  describe('createMembership', () => {
    it('should persist an invited membership with nullable invitation metadata by default', async () => {
      const owner = await factory.user({
        mezonId: 'team-member-create-owner',
      });
      const project = await createProject(
        'team-member-create-project',
        owner.id,
      );
      const team = await factory.team({
        projectId: project.id,
        slug: 'team-member-create-team',
      });
      const user = await factory.user({
        mezonId: 'team-member-create-user',
      });

      const membership = await teamMemberService.createMembership({
        teamId: team.id,
        userId: user.id,
      });

      expect(membership).toMatchObject({
        invitedByUserId: null,
        joinedAt: null,
        status: TeamMemberStatus.INVITED,
        teamId: team.id,
        userId: user.id,
      });

      await expect(
        teamMemberRepository.findOneByOrFail({ id: membership.id }),
      ).resolves.toMatchObject({
        invitedByUserId: null,
        joinedAt: null,
        status: TeamMemberStatus.INVITED,
        teamId: team.id,
        userId: user.id,
      });
    });

    it('should reject creating the same membership twice for one team and user', async () => {
      const owner = await factory.user({
        mezonId: 'team-member-duplicate-owner',
      });
      const project = await createProject(
        'team-member-duplicate-project',
        owner.id,
      );
      const team = await factory.team({
        projectId: project.id,
        slug: 'team-member-duplicate-team',
      });
      const user = await factory.user({
        mezonId: 'team-member-duplicate-user',
      });

      await factory.teamMember({
        teamId: team.id,
        userId: user.id,
      });

      await expect(
        teamMemberService.createMembership({
          teamId: team.id,
          userId: user.id,
        }),
      ).rejects.toThrow();
    });
  });

  describe('findMembership', () => {
    it('should return the membership when the user already belongs to the team', async () => {
      const owner = await factory.user({
        mezonId: 'team-member-find-owner',
      });
      const project = await createProject('team-member-find-project', owner.id);
      const team = await factory.team({
        projectId: project.id,
        slug: 'team-member-find-team',
      });
      const user = await factory.user({
        mezonId: 'team-member-find-user',
      });
      const membership = await factory.teamMember({
        status: TeamMemberStatus.ACTIVE,
        teamId: team.id,
        userId: user.id,
      });

      await expect(
        teamMemberService.findMembership(membership.teamId, membership.userId),
      ).resolves.toMatchObject({
        id: membership.id,
        status: TeamMemberStatus.ACTIVE,
        teamId: membership.teamId,
        userId: membership.userId,
      });
    });

    it('should return null when the team membership has not been created', async () => {
      const owner = await factory.user({
        mezonId: 'team-member-missing-owner',
      });
      const project = await createProject(
        'team-member-missing-project',
        owner.id,
      );
      const team = await factory.team({
        projectId: project.id,
        slug: 'team-member-missing-team',
      });
      const user = await factory.user({
        mezonId: 'team-member-missing-user',
      });

      await expect(
        teamMemberService.findMembership(team.id, user.id),
      ).resolves.toBeNull();
    });
  });

  describe('findByTeamId', () => {
    it('should list memberships for one team in ascending id order', async () => {
      const owner = await factory.user({
        mezonId: 'team-member-list-owner',
      });
      const project = await createProject('team-member-list-project', owner.id);
      const team = await factory.team({
        projectId: project.id,
        slug: 'team-member-list-team',
      });
      const firstMembership = await factory.teamMember({
        status: TeamMemberStatus.INVITED,
        teamId: team.id,
        userId: (await factory.user({ mezonId: 'team-member-list-user-1' })).id,
      });
      const secondMembership = await factory.teamMember({
        status: TeamMemberStatus.ACTIVE,
        teamId: team.id,
        userId: (await factory.user({ mezonId: 'team-member-list-user-2' })).id,
      });

      const otherOwner = await factory.user({
        mezonId: 'team-member-list-other-owner',
      });
      const otherProject = await createProject(
        'team-member-list-other-project',
        otherOwner.id,
      );
      const otherTeam = await factory.team({
        projectId: otherProject.id,
        slug: 'team-member-list-other-team',
      });

      await factory.teamMember({
        teamId: otherTeam.id,
        userId: (await factory.user({ mezonId: 'team-member-list-other-user' }))
          .id,
      });

      const memberships = await teamMemberService.findByTeamId(team.id);

      expect(memberships.map((membership) => membership.id)).toEqual([
        firstMembership.id,
        secondMembership.id,
      ]);
    });
  });

  describe('findActiveMembersByTeamId', () => {
    it('should return only active memberships for the requested team in ascending id order', async () => {
      const owner = await factory.user({
        mezonId: 'team-member-active-owner',
      });
      const project = await createProject(
        'team-member-active-project',
        owner.id,
      );
      const team = await factory.team({
        projectId: project.id,
        slug: 'team-member-active-team',
      });
      const activeMembership = await factory.teamMember({
        status: TeamMemberStatus.ACTIVE,
        teamId: team.id,
        userId: (await factory.user({ mezonId: 'team-member-active-user' })).id,
      });

      await factory.teamMember({
        status: TeamMemberStatus.INVITED,
        teamId: team.id,
        userId: (await factory.user({ mezonId: 'team-member-invited-user' }))
          .id,
      });

      const otherOwner = await factory.user({
        mezonId: 'team-member-active-other-owner',
      });
      const otherProject = await createProject(
        'team-member-active-other-project',
        otherOwner.id,
      );
      const otherTeam = await factory.team({
        projectId: otherProject.id,
        slug: 'team-member-active-other-team',
      });

      await factory.teamMember({
        status: TeamMemberStatus.ACTIVE,
        teamId: otherTeam.id,
        userId: (
          await factory.user({ mezonId: 'team-member-active-other-user' })
        ).id,
      });

      const memberships = await teamMemberService.findActiveMembersByTeamId(
        team.id,
      );

      expect(memberships).toEqual([
        expect.objectContaining({
          id: activeMembership.id,
          status: TeamMemberStatus.ACTIVE,
          teamId: team.id,
        }),
      ]);
    });
  });
});
