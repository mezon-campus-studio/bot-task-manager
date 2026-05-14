import { ProjectCommandHandler } from './project-command.handler';

describe(ProjectCommandHandler.name, () => {
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
    projectService?: Partial<Record<string, jest.Mock>>;
  }) {
    const projectContextService = {
      exitProjectByMezonId: jest.fn(),
      getCurrentProjectByMezonId: jest.fn(),
      useProjectByMezonId: jest.fn(),
      ...overrides?.projectContextService,
    };
    const projectService = {
      createProject: jest.fn(),
      listProjects: jest.fn(),
      ...overrides?.projectService,
    };

    return {
      handler: new ProjectCommandHandler(
        projectContextService as never,
        projectService as never,
      ),
      projectContextService,
      projectService,
    };
  }

  it('lists available projects with ids and slugs', async () => {
    const message = createMessage();
    const { handler, projectService } = createHandler({
      projectService: {
        listProjects: jest.fn().mockResolvedValue([
          { id: 10, name: 'Backend Campus', slug: 'backend' },
          { id: 11, name: 'Frontend Campus', slug: 'frontend' },
        ]),
      },
    });

    await handler.handleProjectCommand(['list'], message, {} as never);

    expect(projectService.listProjects).toHaveBeenCalledTimes(1);
    expectReplyText(message as never, '[#10] Backend Campus (`backend`)');
  });

  it('prints an empty-state message when no projects exist', async () => {
    const message = createMessage();
    const { handler } = createHandler({
      projectService: {
        listProjects: jest.fn().mockResolvedValue([]),
      },
    });

    await handler.handleProjectCommand(['list'], message, {} as never);

    expectReplyText(message as never, 'No projects found.');
  });
});
