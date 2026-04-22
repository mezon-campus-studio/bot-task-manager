import { createTestingModule, factory, testingModule } from '#jest';
import { ProjectMemberStatus } from './project-member-status.enum';
import { ProjectMemberService } from './project-member.service';

describe(ProjectMemberService.name, () => {
  let projectMemberService: ProjectMemberService;

  beforeAll(createTestingModule);

  beforeAll(() => {
    projectMemberService = testingModule!.get(ProjectMemberService);
  });

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
});
