import { TaskStatus } from './enums';
import { TaskCommandHandler } from './task-command.handler';

describe(TaskCommandHandler.name, () => {
  function expectReplyText(message: { reply: jest.Mock }, text: string): void {
    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          t: expect.stringContaining(text),
        }),
      }),
    );
  }

  function createMessage(senderId = 'mezon-user-1') {
    return {
      reply: jest.fn().mockResolvedValue(undefined),
      senderId,
    } as never;
  }

  function createHandler(overrides?: {
    projectContextService?: Partial<Record<string, jest.Mock>>;
    taskService?: Partial<Record<string, jest.Mock>>;
    userService?: Partial<Record<string, jest.Mock>>;
  }) {
    const context = {
      project: { id: 7, name: 'Campus Core', slug: 'campus-core' },
      projectId: 7,
      user: { id: 'user-1', mezonId: 'mezon-user-1', name: 'Reporter' },
    };
    const projectContextService = {
      getRequiredCurrentProjectByMezonId: jest.fn().mockResolvedValue(context),
      ...overrides?.projectContextService,
    };
    const taskService = {
      assignTask: jest.fn(),
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      findById: jest.fn(),
      listByProject: jest.fn(),
      updateTaskStatus: jest.fn(),
      ...overrides?.taskService,
    };
    const userService = {
      findByIdentifier: jest.fn(),
      ...overrides?.userService,
    };

    return {
      context,
      handler: new TaskCommandHandler(
        taskService as never,
        projectContextService as never,
        userService as never,
      ),
      projectContextService,
      taskService,
      userService,
    };
  }

  it('lists tasks in the current project', async () => {
    const message = createMessage();
    const { handler, taskService } = createHandler({
      taskService: {
        listByProject: jest.fn().mockResolvedValue([
          {
            assigneeUserId: null,
            id: 4,
            status: TaskStatus.TODO,
            title: 'Prepare launch',
          },
        ]),
      },
    });

    await handler.handleTaskCommand(['list'], message);

    expect(taskService.listByProject).toHaveBeenCalledWith(7);
    expectReplyText(message as never, '[#4] Prepare launch - TODO');
  });

  it('creates a task with the current user as reporter', async () => {
    const message = createMessage();
    const { handler, taskService } = createHandler({
      taskService: {
        createTask: jest.fn().mockResolvedValue({
          id: 8,
          title: 'Write release notes',
        }),
      },
    });

    await handler.handleTaskCommand(
      ['create', 'Write', 'release', 'notes'],
      message,
    );

    expect(taskService.createTask).toHaveBeenCalledWith({
      projectId: 7,
      reporterUserId: 'user-1',
      title: 'Write release notes',
    });
    expectReplyText(
      message as never,
      'Created task **#8: Write release notes**',
    );
  });

  it('shows task details only when the task belongs to the current project', async () => {
    const message = createMessage();
    const { handler } = createHandler({
      taskService: {
        findById: jest.fn().mockResolvedValue({
          assigneeUserId: 'user-2',
          id: 8,
          priority: 'HIGH',
          projectId: 7,
          reporterUserId: 'user-1',
          status: TaskStatus.IN_PROGRESS,
          title: 'Write release notes',
        }),
      },
    });

    await handler.handleTaskCommand(['detail', '8'], message);

    expectReplyText(message as never, '**Task #8**');
  });

  it('updates task status with the current user as author', async () => {
    const message = createMessage();
    const { handler, taskService } = createHandler({
      taskService: {
        findById: jest.fn().mockResolvedValue({ id: 8, projectId: 7 }),
        updateTaskStatus: jest.fn().mockResolvedValue({
          id: 8,
          status: TaskStatus.IN_PROGRESS,
          title: 'Write release notes',
        }),
      },
    });

    await handler.handleTaskCommand(['status', '8', 'in_progress'], message);

    expect(taskService.updateTaskStatus).toHaveBeenCalledWith(8, {
      authorUserId: 'user-1',
      status: TaskStatus.IN_PROGRESS,
    });
  });

  it('assigns a task to a resolved user identifier', async () => {
    const message = createMessage();
    const { handler, taskService, userService } = createHandler({
      taskService: {
        assignTask: jest.fn().mockResolvedValue({
          assigneeUserId: 'user-2',
          id: 8,
          title: 'Write release notes',
        }),
        findById: jest.fn().mockResolvedValue({ id: 8, projectId: 7 }),
      },
      userService: {
        findByIdentifier: jest.fn().mockResolvedValue({
          id: 'user-2',
          mezonId: 'mezon-user-2',
          name: 'Assignee',
        }),
      },
    });

    await handler.handleTaskCommand(['assign', '8', 'mezon-user-2'], message);

    expect(userService.findByIdentifier).toHaveBeenCalledWith('mezon-user-2');
    expect(taskService.assignTask).toHaveBeenCalledWith(8, 'user-2');
  });

  it('deletes a task from the current project', async () => {
    const message = createMessage();
    const { handler, taskService } = createHandler({
      taskService: {
        deleteTask: jest.fn().mockResolvedValue(true),
        findById: jest.fn().mockResolvedValue({ id: 8, projectId: 7 }),
      },
    });

    await handler.handleTaskCommand(['delete', '8'], message);

    expect(taskService.deleteTask).toHaveBeenCalledWith(8);
  });
});
