import { createTestingModule, factory, testingModule } from '#jest';
import { ProjectOnboardingStatus } from './project.enums';
import { ProjectService } from './project.service';

describe(ProjectService.name, () => {
  let projectService: ProjectService;

  beforeAll(createTestingModule);

  beforeAll(() => {
    projectService = testingModule!.get(ProjectService);
  });

  it('creates a project with pending onboarding defaults when optional fields are omitted', async () => {
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
      onboardingCompletedAt: null,
      onboardingStatus: ProjectOnboardingStatus.PENDING,
      ownerUserId: owner.id,
      slug: 'campus-alpha',
    });
  });

  it('preserves the provided onboarding fields when project setup is already completed', async () => {
    const owner = await factory.user({
      email: 'project-owner-beta@example.com',
      mezonId: 'project-owner-beta',
      name: 'Project Owner Beta',
    });
    const onboardingCompletedAt = new Date('2026-04-19T11:30:00.000Z');

    const project = await projectService.createProject({
      description: 'Initial project brief',
      name: 'Campus Beta',
      onboardingCompletedAt,
      onboardingStatus: ProjectOnboardingStatus.COMPLETED,
      ownerUserId: owner.id,
      slug: 'campus-beta',
    });

    expect(project).toMatchObject({
      description: 'Initial project brief',
      name: 'Campus Beta',
      onboardingCompletedAt,
      onboardingStatus: ProjectOnboardingStatus.COMPLETED,
      ownerUserId: owner.id,
      slug: 'campus-beta',
    });
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
});
