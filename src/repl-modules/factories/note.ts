import { NoteResourceType } from '@src/modules/note/enums';
import NoteEntity from '@src/modules/note/note.entity';
import { Factory } from './factory';
import { project } from './project';
import { user } from './user';

export const note = Factory.forEntity<NoteEntity>(NoteEntity, async (input) => {
  const projectId = input.projectId ?? (await project({})).id;
  const authorUserId = input.authorUserId ?? (await user({})).id;

  return {
    ...input,
    authorUserId,
    content: input.content ?? 'Campus note content',
    projectId,
    resourceId: input.resourceId ?? `resource-${projectId}`,
    resourceType: input.resourceType ?? NoteResourceType.PROJECT,
  };
});
