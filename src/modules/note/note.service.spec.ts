import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { NoteResourceType } from './enums';
import NoteEntity from './note.entity';
import { NoteService } from './note.service';
import { ProjectMemberStatus } from '../project-member/project-member-status.enum';
import { TeamMemberStatus } from '../team-member';

describe(NoteService.name, () => {
  let noteService: NoteService;
  let noteRepository: Repository<NoteEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    noteService = testingModule!.get(NoteService);
    noteRepository = testingModule!.get(DataSource).getRepository(NoteEntity);
  });

  afterEach(async () => {
    await noteRepository.query('TRUNCATE TABLE "notes" CASCADE;');
  });

  async function createNoteContext() {
    const project = await factory.project({});
    const author = await factory.user({});
    const assignee = await factory.user({});
    const reporter = await factory.user({});

    const team = await factory.team({
      projectId: project.id,
    });

    await factory.projectMember({
      projectId: project.id,
      userId: author.id,
      status: ProjectMemberStatus.ACTIVE,
    });
    await factory.projectMember({
      projectId: project.id,
      userId: assignee.id,
      status: ProjectMemberStatus.ACTIVE,
    });
    await factory.projectMember({
      projectId: project.id,
      userId: reporter.id,
      status: ProjectMemberStatus.ACTIVE,
    });

    await factory.teamMember({
      teamId: team.id,
      userId: author.id,
      status: TeamMemberStatus.ACTIVE,
    });
    await factory.teamMember({
      teamId: team.id,
      userId: assignee.id,
      status: TeamMemberStatus.ACTIVE,
    });
    await factory.teamMember({
      teamId: team.id,
      userId: reporter.id,
      status: TeamMemberStatus.ACTIVE,
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
    // Chỉ update các field nằm trong UpdateNoteInput (content, isShared, isPinned)
    // resourceId và resourceType không được hỗ trợ qua updateEntry nên không test ở đây

    await updateSession.save();

    await expect(
      noteRepository.findOneByOrFail({ id: note.id }),
    ).resolves.toMatchObject({
      content: 'Follow-up completed after the status check.',
      id: note.id,
      // resourceId và resourceType giữ nguyên giá trị ban đầu
      resourceId: 'task-14',
      resourceType: NoteResourceType.TASK,
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

    // UpdateNoteInput chỉ hỗ trợ: content | isShared | isPinned
    // Không truyền resourceId vì không nằm trong UpdateNoteInput
    await noteService.updateEntry(note, {
      content: 'Advisor confirmed the final plan after the review.',
    });

    expect(note).toMatchObject({
      content: 'Advisor confirmed the final plan after the review.',
      resourceId: 'project-9', // giữ nguyên
    });

    await expect(
      noteRepository.findOneByOrFail({ id: note.id }),
    ).resolves.toMatchObject({
      content: 'Advisor confirmed the final plan after the review.',
      id: note.id,
      resourceId: 'project-9', // giữ nguyên
      resourceType: NoteResourceType.PROJECT,
    });
  });

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
