import { randomUUID } from 'node:crypto';
import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { SearchOrder } from '@src/common/enums';
import { NoteResourceType } from '@src/modules/note/enums';
import NoteEntity from '@src/modules/note/note.entity';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import { TeamMemberStatus } from '@src/modules/team-member/enums/team-member-status.enum';
import { TaskPriority, TaskStatus } from './enums';
import TaskEntity from './task.entity';
import { TaskService } from './task.service';

describe(TaskService.name, () => {
  let taskService: TaskService;
  let noteRepository: Repository<NoteEntity>;
  let taskRepository: Repository<TaskEntity>;
  let numericSequence = 0;

  beforeAll(createTestingModule);

  beforeAll(() => {
    taskService = testingModule!.get(TaskService);
    noteRepository = testingModule!.get(DataSource).getRepository(NoteEntity);
    taskRepository = testingModule!.get(DataSource).getRepository(TaskEntity);
  });

  function nextNumericId() {
    numericSequence += 1;
    return numericSequence;
  }

  async function createTaskContext() {
    const project = await factory.project({});
    const reporter = await factory.user({});
    const assignee = await factory.user({});
    const team = await factory.team({
      projectId: project.id,
    });
    return {
      assigneeUserId: assignee.id,
      projectId: project.id,
      reporterUserId: reporter.id,
      teamId: team.id,
    };
  }

  async function createProjectTaskContext() {
    const project = await factory.project({});
    const reporter = await factory.user({});

    return {
      projectId: project.id,
      reporterUserId: reporter.id,
    };
  }

  async function createTeamTaskContext() {
    const project = await factory.project({});
    const reporter = await factory.user({});
    const team = await factory.team({
      projectId: project.id,
    });

    return {
      projectId: project.id,
      reporterUserId: reporter.id,
      teamId: team.id,
    };
  }

  it('should create a task for the project workflow with the provided schedule', async () => {
    const { assigneeUserId, projectId, reporterUserId, teamId } =
      await createTaskContext();
    const dueAt = new Date('2026-05-01T09:00:00.000Z');

    const task = await taskService.createTask({
      assigneeUserId,
      description:
        'Prepare the onboarding checklist before the campus rollout.',
      dueAt,
      priority: TaskPriority.HIGH,
      projectId,
      reporterUserId,
      status: TaskStatus.TODO,
      teamId,
      title: 'Prepare onboarding checklist',
    });

    expect(task).toMatchObject({
      assigneeUserId,
      description:
        'Prepare the onboarding checklist before the campus rollout.',
      id: expect.any(Number),
      priority: TaskPriority.HIGH,
      projectId,
      reporterUserId,
      status: TaskStatus.TODO,
      teamId,
      title: 'Prepare onboarding checklist',
    });
    expect(task.dueAt?.toISOString()).toBe(dueAt.toISOString());

    const storedTask = await taskRepository.findOneByOrFail({ id: task.id });

    expect(storedTask).toMatchObject({
      assigneeUserId,
      priority: TaskPriority.HIGH,
      projectId,
      reporterUserId,
      status: TaskStatus.TODO,
      teamId,
      title: 'Prepare onboarding checklist',
    });
    expect(storedTask.dueAt?.toISOString()).toBe(dueAt.toISOString());
  });

  it('should return only project tasks ordered by due date and newest id for ties', async () => {
    const { assigneeUserId, projectId, reporterUserId, teamId } =
      await createTaskContext();
    const otherProjectId = nextNumericId();
    const sharedDueAt = new Date('2026-06-15T09:00:00.000Z');

    const firstTask = await factory.task({
      assigneeUserId,
      dueAt: new Date('2026-06-14T09:00:00.000Z'),
      projectId,
      reporterUserId,
      teamId,
      title: 'Kick off student invite review',
    });
    const olderSameDayTask = await factory.task({
      assigneeUserId,
      dueAt: sharedDueAt,
      projectId,
      reporterUserId,
      teamId,
      title: 'Validate advisor assignments',
    });
    const newerSameDayTask = await factory.task({
      assigneeUserId,
      dueAt: sharedDueAt,
      projectId,
      reporterUserId,
      teamId,
      title: 'Share the launch brief',
    });

    await factory.task({
      dueAt: new Date('2026-06-13T09:00:00.000Z'),
      projectId: otherProjectId,
      reporterUserId: randomUUID(),
      teamId: nextNumericId(),
      title: 'Ignore other project task',
    });

    const tasks = await taskService.listByProject(projectId);

    expect(tasks).toHaveLength(3);
    expect(tasks.map(({ id }) => id)).toEqual([
      firstTask.id,
      newerSameDayTask.id,
      olderSameDayTask.id,
    ]);
    expect(tasks.every((task) => task.projectId === projectId)).toBe(true);
  });

  it('should query tasks by project and supported filters', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const assignee = await factory.user({});
    const team = await factory.team({
      projectId,
    });
    const otherProject = await factory.project({});

    const matchingTask = await factory.task({
      assigneeUserId: assignee.id,
      priority: TaskPriority.HIGH,
      projectId,
      reporterUserId,
      status: TaskStatus.IN_PROGRESS,
      teamId: team.id,
      title: 'Review the matched task filter',
    });

    await factory.task({
      assigneeUserId: assignee.id,
      priority: TaskPriority.HIGH,
      projectId,
      reporterUserId,
      status: TaskStatus.TODO,
      teamId: team.id,
      title: 'Ignore task with different status',
    });
    await factory.task({
      assigneeUserId: assignee.id,
      priority: TaskPriority.HIGH,
      projectId: otherProject.id,
      reporterUserId,
      status: TaskStatus.IN_PROGRESS,
      teamId: team.id,
      title: 'Ignore matching task from another project',
    });

    const result = await taskService.queryTasks(projectId, {
      assigneeUserId: assignee.id,
      priority: TaskPriority.HIGH,
      reporterUserId,
      status: TaskStatus.IN_PROGRESS,
      teamId: team.id,
    });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 1,
    });
    expect(result.result).toHaveLength(1);
    expect(result.result[0]).toMatchObject({
      id: matchingTask.id,
      projectId,
      status: TaskStatus.IN_PROGRESS,
    });
  });

  it('should search project tasks by keyword in title or description', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const otherProject = await factory.project({});

    const titleMatchTask = await factory.task({
      description: null,
      projectId,
      reporterUserId,
      title: 'Prepare advisor onboarding notes',
    });
    const descriptionMatchTask = await factory.task({
      description: 'Confirm the ADVISOR invite list before launch.',
      projectId,
      reporterUserId,
      title: 'Prepare invite list',
    });

    await factory.task({
      description: 'Advisor keyword belongs to another project.',
      projectId: otherProject.id,
      title: 'Ignore cross project keyword',
    });

    const result = await taskService.queryTasks(projectId, {
      q: 'advisor',
    });

    expect(result.total).toBe(2);
    expect(result.result.map(({ id }) => id)).toEqual([
      descriptionMatchTask.id,
      titleMatchTask.id,
    ]);
  });

  it('should paginate task query results with a stable order', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();

    await factory.task({
      dueAt: new Date('2026-08-01T09:00:00.000Z'),
      projectId,
      reporterUserId,
      title: 'First paginated task',
    });
    const secondTask = await factory.task({
      dueAt: new Date('2026-08-02T09:00:00.000Z'),
      projectId,
      reporterUserId,
      title: 'Second paginated task',
    });
    const thirdTask = await factory.task({
      dueAt: new Date('2026-08-03T09:00:00.000Z'),
      projectId,
      reporterUserId,
      title: 'Third paginated task',
    });

    const result = await taskService.queryTasks(projectId, {
      page: 2,
      take: 1,
    });

    expect(result).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 3,
    });
    expect(result.result).toHaveLength(1);
    expect(result.result[0]).toMatchObject({
      id: secondTask.id,
      projectId,
    });

    const descendingResult = await taskService.queryTasks(projectId, {
      order: SearchOrder.DESC,
      page: 1,
      take: 1,
    });

    expect(descendingResult.result[0]).toMatchObject({
      id: thirdTask.id,
      projectId,
    });
  });

  it('should assign a task to an active project member', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const assignee = await factory.user({});
    const task = await factory.task({
      assigneeUserId: null,
      projectId,
      reporterUserId,
      teamId: null,
      title: 'Confirm department approvals',
    });

    await factory.projectMember({
      projectId,
      status: ProjectMemberStatus.ACTIVE,
      userId: assignee.id,
    });

    const updatedTask = await taskService.assignTask(task.id, assignee.id);

    expect(updatedTask).toMatchObject({
      assigneeUserId: assignee.id,
      id: task.id,
    });

    await expect(
      taskRepository.findOneByOrFail({ id: task.id }),
    ).resolves.toMatchObject({
      assigneeUserId: assignee.id,
      id: task.id,
      status: TaskStatus.TODO,
    });
  });

  it('should assign a project task to an active member of a team in the project', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const assignee = await factory.user({});
    const task = await factory.task({
      assigneeUserId: null,
      projectId,
      reporterUserId,
      teamId: null,
      title: 'Coordinate team-wide project handoff',
    });
    const team = await factory.team({
      projectId,
      slug: 'project-task-team-access',
    });

    await factory.teamMember({
      status: TeamMemberStatus.ACTIVE,
      teamId: team.id,
      userId: assignee.id,
    });

    const updatedTask = await taskService.assignTask(task.id, assignee.id);

    expect(updatedTask).toMatchObject({
      assigneeUserId: assignee.id,
      id: task.id,
      projectId,
      teamId: null,
    });
  });

  it('should assign a task to an active team member when the task belongs to a team', async () => {
    const { projectId, reporterUserId, teamId } = await createTeamTaskContext();
    const assignee = await factory.user({});
    const task = await factory.task({
      assigneeUserId: null,
      projectId,
      reporterUserId,
      teamId,
      title: 'Share the admissions handoff plan',
    });

    await factory.teamMember({
      status: TeamMemberStatus.ACTIVE,
      teamId,
      userId: assignee.id,
    });

    const updatedTask = await taskService.assignTask(task.id, assignee.id);

    expect(updatedTask).toMatchObject({
      assigneeUserId: assignee.id,
      id: task.id,
      teamId,
    });
  });

  it('should reject assigning a task to a non-active project member', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const assignee = await factory.user({});
    const task = await factory.task({
      assigneeUserId: null,
      projectId,
      reporterUserId,
      teamId: null,
      title: 'Review the intake form changes',
    });

    await factory.projectMember({
      projectId,
      status: ProjectMemberStatus.INVITED,
      userId: assignee.id,
    });

    await expect(taskService.assignTask(task.id, assignee.id)).rejects.toThrow(
      'Task assignee must be an active project member',
    );
  });

  it('should reject assigning a task to a non-active team member', async () => {
    const { projectId, reporterUserId, teamId } = await createTeamTaskContext();
    const assignee = await factory.user({});
    const task = await factory.task({
      assigneeUserId: null,
      projectId,
      reporterUserId,
      teamId,
      title: 'Prepare the faculty support schedule',
    });

    await factory.teamMember({
      status: TeamMemberStatus.DECLINED,
      teamId,
      userId: assignee.id,
    });

    await expect(taskService.assignTask(task.id, assignee.id)).rejects.toThrow(
      'Task assignee must be an active team member',
    );
  });

  it('should return null when the task assignment target does not exist', async () => {
    const assignee = await factory.user({});

    await expect(
      taskService.assignTask(999_999, assignee.id),
    ).resolves.toBeNull();
    await expect(taskRepository.count()).resolves.toBe(0);
  });

  it('should reassign a task to the next active project member', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const currentAssignee = await factory.user({});
    const nextAssignee = await factory.user({});
    const task = await factory.task({
      assigneeUserId: currentAssignee.id,
      projectId,
      reporterUserId,
      status: TaskStatus.IN_PROGRESS,
      teamId: null,
      title: 'Confirm department approvals',
    });

    await factory.projectMember({
      projectId,
      status: ProjectMemberStatus.ACTIVE,
      userId: currentAssignee.id,
    });
    await factory.projectMember({
      projectId,
      status: ProjectMemberStatus.ACTIVE,
      userId: nextAssignee.id,
    });

    const updatedTask = await taskService.reassignTask(
      task.id,
      nextAssignee.id,
    );

    expect(updatedTask).toMatchObject({
      assigneeUserId: nextAssignee.id,
      id: task.id,
    });
  });

  it('should reject reassignment when the task has no assignee yet', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const nextAssignee = await factory.user({});
    const task = await factory.task({
      assigneeUserId: null,
      projectId,
      reporterUserId,
      teamId: null,
      title: 'Finalize the reviewer routing',
    });

    await factory.projectMember({
      projectId,
      status: ProjectMemberStatus.ACTIVE,
      userId: nextAssignee.id,
    });

    await expect(
      taskService.reassignTask(task.id, nextAssignee.id),
    ).rejects.toThrow('Task has no assignee to replace');
  });

  it('should remove the current task assignee', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const assignee = await factory.user({});
    const task = await factory.task({
      assigneeUserId: assignee.id,
      projectId,
      reporterUserId,
      teamId: null,
      title: 'Remove the current assignment after the workflow shift',
    });

    const updatedTask = await taskService.removeTaskAssignee(task.id);

    expect(updatedTask).toMatchObject({
      assigneeUserId: null,
      id: task.id,
    });

    await expect(
      taskRepository.findOneByOrFail({ id: task.id }),
    ).resolves.toMatchObject({
      assigneeUserId: null,
      id: task.id,
    });
  });

  it('should return null when removing the assignee from a missing task', async () => {
    await expect(taskService.removeTaskAssignee(999_999)).resolves.toBeNull();
  });

  it('should update task status from TODO to IN_PROGRESS and persist the change', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const author = await factory.user({});
    const task = await factory.task({
      projectId,
      reporterUserId,
      status: TaskStatus.TODO,
      teamId: null,
      title: 'Start the review workflow',
    });

    const updatedTask = await taskService.updateTaskStatus(task.id, {
      authorUserId: author.id,
      status: TaskStatus.IN_PROGRESS,
    });

    expect(updatedTask).toMatchObject({
      id: task.id,
      status: TaskStatus.IN_PROGRESS,
    });

    await expect(
      taskRepository.findOneByOrFail({ id: task.id }),
    ).resolves.toMatchObject({
      id: task.id,
      status: TaskStatus.IN_PROGRESS,
    });
  });

  it('should update task status from IN_PROGRESS to DONE and save a task history note', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const author = await factory.user({});
    const task = await factory.task({
      projectId,
      reporterUserId,
      status: TaskStatus.IN_PROGRESS,
      teamId: null,
      title: 'Complete the review workflow',
    });

    const updatedTask = await taskService.updateTaskStatus(task.id, {
      authorUserId: author.id,
      status: TaskStatus.DONE,
    });

    expect(updatedTask).toMatchObject({
      id: task.id,
      status: TaskStatus.DONE,
    });

    await expect(
      noteRepository.findOneByOrFail({
        authorUserId: author.id,
        projectId,
        resourceId: String(task.id),
        resourceType: NoteResourceType.TASK,
      }),
    ).resolves.toMatchObject({
      authorUserId: author.id,
      content: 'Task status changed from IN_PROGRESS to DONE',
      projectId,
      resourceId: String(task.id),
      resourceType: NoteResourceType.TASK,
    });
  });

  it('should return null when updating status for a missing task', async () => {
    const author = await factory.user({});

    await expect(
      taskService.updateTaskStatus(999_999, {
        authorUserId: author.id,
        status: TaskStatus.IN_PROGRESS,
      }),
    ).resolves.toBeNull();
    await expect(noteRepository.count()).resolves.toBe(0);
  });

  it('should reject invalid task status transitions', async () => {
    const { projectId, reporterUserId } = await createProjectTaskContext();
    const author = await factory.user({});
    const task = await factory.task({
      projectId,
      reporterUserId,
      status: TaskStatus.DONE,
      teamId: null,
      title: 'Keep the completed workflow closed',
    });

    await expect(
      taskService.updateTaskStatus(task.id, {
        authorUserId: author.id,
        status: TaskStatus.IN_PROGRESS,
      }),
    ).rejects.toThrow('Task status cannot transition from DONE to IN_PROGRESS');
    await expect(noteRepository.count()).resolves.toBe(0);
  });

  it('should find a task by id', async () => {
    const { projectId, reporterUserId, teamId } = await createTaskContext();
    const task = await factory.task({
      projectId,
      reporterUserId,
      teamId,
      title: 'Review the support handoff notes',
    });

    await expect(taskService.findById(task.id)).resolves.toMatchObject({
      id: task.id,
      projectId,
      reporterUserId,
      teamId,
      title: 'Review the support handoff notes',
    });
  });

  it('should return null when no task matches the requested id', async () => {
    await expect(taskService.findById(999_999)).resolves.toBeNull();
  });

  it('should update an existing task with the provided workflow changes', async () => {
    const { assigneeUserId, projectId, reporterUserId, teamId } =
      await createTaskContext();
    const dueAt = new Date('2026-07-01T09:00:00.000Z');
    const updatedDueAt = new Date('2026-07-10T09:00:00.000Z');
    const task = await factory.task({
      assigneeUserId,
      dueAt,
      projectId,
      reporterUserId,
      status: TaskStatus.TODO,
      teamId,
      title: 'Prepare the launch checklist',
    });

    const updatedTask = await taskService.updateTask(task.id, {
      assigneeUserId: null,
      dueAt: updatedDueAt,
      priority: TaskPriority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      title: 'Finalize the launch checklist',
    });

    expect(updatedTask).toMatchObject({
      assigneeUserId: null,
      id: task.id,
      priority: TaskPriority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      title: 'Finalize the launch checklist',
    });
    expect(updatedTask?.dueAt?.toISOString()).toBe(updatedDueAt.toISOString());

    const storedTask = await taskRepository.findOneByOrFail({ id: task.id });

    expect(storedTask).toMatchObject({
      assigneeUserId: null,
      id: task.id,
      priority: TaskPriority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      title: 'Finalize the launch checklist',
    });
    expect(storedTask.dueAt?.toISOString()).toBe(updatedDueAt.toISOString());
  });

  it('should return null when updating a missing task', async () => {
    await expect(
      taskService.updateTask(999_999, {
        status: TaskStatus.CANCELLED,
      }),
    ).resolves.toBeNull();
  });

  it('should soft delete an existing task', async () => {
    const { projectId, reporterUserId, teamId } = await createTaskContext();
    const task = await factory.task({
      projectId,
      reporterUserId,
      teamId,
      title: 'Archive the completed intake forms',
    });

    await expect(taskService.deleteTask(task.id)).resolves.toBe(true);
    await expect(taskRepository.findOneBy({ id: task.id })).resolves.toBeNull();
    await expect(
      taskRepository.findOne({
        where: { id: task.id },
        withDeleted: true,
      }),
    ).resolves.toMatchObject({
      deletedAt: expect.any(Date),
      id: task.id,
    });
  });

  it('should return false when deleting a missing task', async () => {
    await expect(taskService.deleteTask(999_999)).resolves.toBe(false);
  });

  it('should support updateSession from the CRUD base for task workflow changes', async () => {
    const { projectId, reporterUserId, teamId } = await createTaskContext();
    const task = await factory.task({
      priority: TaskPriority.MEDIUM,
      projectId,
      reporterUserId,
      status: TaskStatus.TODO,
      teamId,
      title: 'Draft the first advisor sync agenda',
    });

    const updateSession = taskService.updateSession(task);

    task.priority = TaskPriority.URGENT;
    task.status = TaskStatus.IN_PROGRESS;
    task.title = 'Finalize the advisor sync agenda';

    await updateSession.save();

    await expect(
      taskRepository.findOneByOrFail({ id: task.id }),
    ).resolves.toMatchObject({
      id: task.id,
      priority: TaskPriority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      title: 'Finalize the advisor sync agenda',
    });
  });

  it('should support updateEntry from the CRUD base for task workflow changes', async () => {
    const { projectId, reporterUserId, teamId } = await createTaskContext();
    const task = await factory.task({
      assigneeUserId: randomUUID(),
      description: 'Initial task detail',
      projectId,
      reporterUserId,
      status: TaskStatus.IN_PROGRESS,
      teamId,
    });

    await taskService.updateEntry(task, {
      assigneeUserId: null,
      description: 'Cancelled after the launch plan changed.',
      status: TaskStatus.CANCELLED,
    });

    expect(task).toMatchObject({
      assigneeUserId: null,
      description: 'Cancelled after the launch plan changed.',
      status: TaskStatus.CANCELLED,
    });

    await expect(
      taskRepository.findOneByOrFail({ id: task.id }),
    ).resolves.toMatchObject({
      assigneeUserId: null,
      description: 'Cancelled after the launch plan changed.',
      id: task.id,
      status: TaskStatus.CANCELLED,
    });
  });
});
