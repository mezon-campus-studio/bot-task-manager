import { randomUUID } from 'node:crypto';
import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { TaskPriority, TaskStatus } from './enums';
import TaskEntity from './task.entity';
import { TaskService } from './task.service';

describe(TaskService.name, () => {
  let taskService: TaskService;
  let taskRepository: Repository<TaskEntity>;
  let numericSequence = 0;

  beforeAll(createTestingModule);

  beforeAll(() => {
    taskService = testingModule!.get(TaskService);
    taskRepository = testingModule!.get(DataSource).getRepository(TaskEntity);
  });

  function nextNumericId() {
    numericSequence += 1;
    return numericSequence;
  }

  function createTaskContext() {
    return {
      assigneeUserId: randomUUID(),
      projectId: nextNumericId(),
      reporterUserId: randomUUID(),
      teamId: nextNumericId(),
    };
  }

  it('should create a task for the project workflow with the provided schedule', async () => {
    const { assigneeUserId, projectId, reporterUserId, teamId } =
      createTaskContext();
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
      createTaskContext();
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

  it('should reassign an existing task to the next workflow owner', async () => {
    const { assigneeUserId, projectId, reporterUserId, teamId } =
      createTaskContext();
    const nextAssigneeUserId = randomUUID();
    const task = await factory.task({
      assigneeUserId,
      projectId,
      reporterUserId,
      status: TaskStatus.IN_PROGRESS,
      teamId,
      title: 'Confirm department approvals',
    });

    const updatedTask = await taskService.assignTask(
      task.id,
      nextAssigneeUserId,
    );

    expect(updatedTask).toMatchObject({
      assigneeUserId: nextAssigneeUserId,
      id: task.id,
    });

    await expect(
      taskRepository.findOneByOrFail({ id: task.id }),
    ).resolves.toMatchObject({
      assigneeUserId: nextAssigneeUserId,
      id: task.id,
      status: TaskStatus.IN_PROGRESS,
    });
  });

  it('should return null when the task assignment target does not exist', async () => {
    await expect(
      taskService.assignTask(999_999, randomUUID()),
    ).resolves.toBeNull();
    await expect(taskRepository.count()).resolves.toBe(0);
  });

  it('should support updateSession from the CRUD base for task workflow changes', async () => {
    const { projectId, reporterUserId, teamId } = createTaskContext();
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
    const { projectId, reporterUserId, teamId } = createTaskContext();
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
