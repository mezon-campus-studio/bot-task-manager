import { randomUUID } from 'node:crypto';
import TeamEntity from '@src/modules/team/team.entity';
import { Factory } from './factory';
import { project } from './project';

export const team = Factory.forEntity<TeamEntity>(
  TeamEntity,
  async (input, repository, _dataSource, _appModule, store) => {
    const generatedSlugs = (store.teamSlugs ??= new Set<string>());

    let slug = input.slug;
    if (!slug) {
      do {
        slug = `team-${randomUUID().slice(0, 8)}`;
      } while (generatedSlugs.has(slug));
    }

    generatedSlugs.add(slug);

    const projectId = input.projectId ?? (await project({})).id;
    const name =
      input.name ??
      slug
        .split('-')
        .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
        .join(' ');

    const existingTeam = await repository.findOne({
      where: { projectId, slug },
    });

    if (existingTeam != null) {
      return existingTeam;
    }

    return {
      createdBy: input.createdBy ?? null,
      deletedAt: input.deletedAt ?? null,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      name,
      projectId,
      slug,
      updatedBy: input.updatedBy ?? null,
      ...input,
    };
  },
);
