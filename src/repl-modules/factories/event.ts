import { EventStatus } from '@src/modules/event/enums';
import EventEntity from '@src/modules/event/event.entity';
import { Factory } from './factory';
import { project } from './project';
import { user } from './user';

export const event = Factory.forEntity<EventEntity>(
  EventEntity,
  async (input) => {
    const projectId = input.projectId ?? (await project({})).id;
    const ownerUserId = input.ownerUserId ?? (await user({})).id;
    const startsAt = input.startsAt ?? new Date('2026-01-01T09:00:00.000Z');

    return {
      ...input,
      description: input.description ?? null,
      endsAt: input.endsAt ?? null,
      location: input.location ?? null,
      ownerUserId,
      projectId,
      startsAt,
      status: input.status ?? EventStatus.DRAFT,
      teamId: input.teamId ?? null,
      title: input.title ?? 'Campus event',
    };
  },
);
