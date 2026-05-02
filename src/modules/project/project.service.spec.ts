import { ConflictException } from '@nestjs/common';
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
