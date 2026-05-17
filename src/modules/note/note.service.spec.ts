import { randomUUID } from 'node:crypto';
import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { NoteResourceType } from './enums';
import NoteEntity from './note.entity';
import { NoteService } from './note.service';

describe(NoteService.name, () => {
  let noteService: NoteService;
  let noteRepository: Repository<NoteEntity>;
  let numericSequence = 0;

  beforeAll(createTestingModule);

  beforeAll(() => {
    noteService = testingModule!.get(NoteService);
    noteRepository = testingModule!.get(DataSource).getRepository(NoteEntity);
  });

  function nextNumericId() {
    numericSequence += 1;
    return numericSequence;
  }

  async function createNoteContext() {
    const project = await factory.project({});
    const author = await factory.user({});
    const assignee = await factory.user({});
    const reporter = await factory.user({});
    const team = await factory.team({
      projectId: project.id,
    });

    const task = await factory.task({
      projectId: project.id,
      teamId: team.id,
      assigneeUserId: assignee.id,
      reporterUserId: reporter.id,
    });

    return {
      authorUserId: author.id,
      projectId: project.id,
      task,
    };
  }

  it('should create a note on the target project resource thread', async () => {
    const { authorUserId, projectId, task } = await createNoteContext();

    const note = await noteService.createNote({
      authorUserId,
      content: 'Waiting for the final approval from the project owner.',
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
      isShared: true,
    });

    expect(note).toMatchObject({
      authorUserId,
      content: 'Waiting for the final approval from the project owner.',
      id: expect.any(Number),
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
      isShared: true,
      isPinned: false,
    });

    await expect(
      noteRepository.findOneByOrFail({ id: note.id }),
    ).resolves.toMatchObject({
      authorUserId,
      content: 'Waiting for the final approval from the project owner.',
      id: note.id,
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
      isShared: true,
      isPinned: false,
    });
  });

  it('should return only notes for the requested resource in newest-first order', async () => {
    const { authorUserId, projectId, task } = await createNoteContext();
    const otherProjectId = nextNumericId();

    const olderNote = await factory.note({
      authorUserId,
      content: 'Initial intake summary.',
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
    });
    const newerNote = await factory.note({
      authorUserId,
      content: 'Updated after meeting with campus advisors.',
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
    });

    await factory.note({
      authorUserId: randomUUID(),
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TICKET,
    });
    await factory.note({
      authorUserId: randomUUID(),
      projectId,
      resourceId: 'other-resource',
      resourceType: NoteResourceType.TASK,
    });
    await factory.note({
      authorUserId: randomUUID(),
      projectId: otherProjectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
    });

    const notes = await noteService.listByResource(
      projectId,
      NoteResourceType.TASK,
      String(task.id),
    );

    expect(notes).toHaveLength(2);
    expect(notes.map(({ id }) => id)).toEqual([newerNote.id, olderNote.id]);
    expect(
      notes.every(
        (note) =>
          note.projectId === projectId &&
          note.resourceId === String(task.id) &&
          note.resourceType === NoteResourceType.TASK,
      ),
    ).toBe(true);
  });

  it('should support updateSession from the CRUD base for note thread changes', async () => {
    const { authorUserId, projectId } = await createNoteContext();
    const note = await factory.note({
      authorUserId,
      content: 'Needs follow-up after the first status check.',
      projectId,
      resourceId: 'task-14',
      resourceType: NoteResourceType.TASK,
    });

    const updateSession = noteService.updateSession(note);

    note.content = 'Follow-up completed after the status check.';
    note.resourceId = 'ticket-14';
    note.resourceType = NoteResourceType.TICKET;

    await updateSession.save();

    await expect(
      noteRepository.findOneByOrFail({ id: note.id }),
    ).resolves.toMatchObject({
      content: 'Follow-up completed after the status check.',
      id: note.id,
      resourceId: 'ticket-14',
      resourceType: NoteResourceType.TICKET,
    });
  });

  it('should support updateEntry from the CRUD base for note content corrections', async () => {
    const { authorUserId, projectId } = await createNoteContext();
    const note = await factory.note({
      authorUserId,
      content: 'Advisor confirmed the draft plan.',
      projectId,
      resourceId: 'project-9',
      resourceType: NoteResourceType.PROJECT,
    });

    await noteService.updateEntry(note, {
      content: 'Advisor confirmed the final plan after the review.',
      resourceId: 'project-9-final',
    });

    expect(note).toMatchObject({
      content: 'Advisor confirmed the final plan after the review.',
      resourceId: 'project-9-final',
    });

    await expect(
      noteRepository.findOneByOrFail({ id: note.id }),
    ).resolves.toMatchObject({
      content: 'Advisor confirmed the final plan after the review.',
      id: note.id,
      resourceId: 'project-9-final',
      resourceType: NoteResourceType.PROJECT,
    });
  });

  //pinned note test
  it('should return pinned notes first', async () => {
    const { authorUserId, projectId, task } = await createNoteContext();

    const normalNote = await factory.note({
      authorUserId,
      content: 'Normal note',
      isPinned: false,
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
    });

    const pinnedNote = await factory.note({
      authorUserId,
      content: 'Pinned note',
      isPinned: true,
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
    });

    const notes = await noteService.listByResource(
      projectId,
      NoteResourceType.TASK,
      String(task.id),
    );

    expect(notes).toHaveLength(2);

    expect(notes[0].id).toBe(pinnedNote.id);
    expect(notes[1].id).toBe(normalNote.id);
  });

  // shared note test
  it('should support sharing notes inside current project', async () => {
    const { authorUserId, projectId } = await createNoteContext();

    const note = await factory.note({
      authorUserId,
      content: 'Internal deployment checklist',
      isShared: false,
      projectId,
      resourceId: 'deploy-1',
      resourceType: NoteResourceType.PROJECT,
    });

    await noteService.updateEntry(note, {
      isShared: true,
    });

    await expect(
      noteRepository.findOneByOrFail({
        id: note.id,
      }),
    ).resolves.toMatchObject({
      id: note.id,
      isShared: true,
    });
  });
});
