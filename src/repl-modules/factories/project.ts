import { randomUUID } from 'node:crypto';
import ProjectEntity from '@src/modules/project/project.entity';
import { ProjectOnboardingStatus } from '@src/modules/project/project.enums';
import { Factory } from './factory';
import { user } from './user';

export const project = Factory.forEntity<ProjectEntity>(
  ProjectEntity,
  async (input, repository, _dataSource, _appModule, store) => {
    const generatedSlugs = (store.projectSlugs ??= new Set<string>());

    let slug = input.slug;
    if (!slug) {
      do {
        slug = `project-${randomUUID().slice(0, 8)}`;
      } while (generatedSlugs.has(slug));
    }

    generatedSlugs.add(slug);

    const existingProject = await repository.findOne({
      where: { slug },
    });

    if (existingProject != null) {
      return existingProject;
    }

    const ownerUserId = input.ownerUserId ?? (await user({})).id;

    const name =
      input.name ??
      slug
        .split('-')
        .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
        .join(' ');

    return {
      description: input.description ?? null,
      name,
      onboardingCompletedAt: input.onboardingCompletedAt ?? null,
      onboardingStatus:
        input.onboardingStatus ?? ProjectOnboardingStatus.PENDING,
      ownerUser: { id: ownerUserId } as never,
      ownerUserId,
      slug,
      ...input,
    };
  },
);
