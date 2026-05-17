import { UserRole } from '@src/common/enums/user.enum';
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
      deleteProject: jest.fn(),
      findById: jest.fn(),
      findByOwnerUserId: jest.fn().mockResolvedValue([]),
      findBySlug: jest.fn(),
      listAccessibleProjectsForUser: jest.fn().mockResolvedValue([]),
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
        listAccessibleProjectsForUser: jest.fn().mockResolvedValue([
          { id: 10, name: 'Backend Campus', slug: 'backend' },
          { id: 11, name: 'Frontend Campus', slug: 'frontend' },
        ]),
        findByOwnerUserId: jest
          .fn()
          .mockResolvedValue([
            { id: 10, name: 'Backend Campus', slug: 'backend' },
          ]),
        listProjects: jest.fn().mockResolvedValue([
          { id: 10, name: 'Backend Campus', slug: 'backend' },
          { id: 11, name: 'Frontend Campus', slug: 'frontend' },
        ]),
      },
    });

    await handler.handleProjectCommand(['list'], message, {
      dbUser: { id: 'user-1' },
    } as never);

    expect(projectService.listAccessibleProjectsForUser).toHaveBeenCalledWith(
      'user-1',
    );
    expect(projectService.listProjects).toHaveBeenCalledTimes(1);
    expectReplyText(message as never, '[#10] Backend Campus (backend) ⭐');
    expectReplyText(message as never, '[#11] Frontend Campus (frontend)');
  });

  it('prints an empty-state message when no projects exist', async () => {
    const message = createMessage();
    const { handler } = createHandler({
      projectService: {
        listAccessibleProjectsForUser: jest.fn().mockResolvedValue([]),
        listProjects: jest.fn().mockResolvedValue([]),
      },
    });

    await handler.handleProjectCommand(['list'], message, {
      dbUser: { id: 'user-1' },
    } as never);

    expectReplyText(message as never, 'You have no projects yet.');
  });

  it('prepares project deletion and requires a confirmation command', async () => {
    const message = createMessage();
    const { handler, projectService } = createHandler({
      projectService: {
        findBySlug: jest.fn().mockResolvedValue({
          id: 12,
          name: 'Delete Campus',
          slug: 'delete-campus',
        }),
      },
    });

    await handler.handleProjectCommand(['delete', 'delete-campus'], message, {
      dbUser: { id: 'admin-user', role: UserRole.ADMIN },
    } as never);

    expect(projectService.deleteProject).not.toHaveBeenCalled();
    expectReplyText(message as never, '*project confirm delete 12');
  });

  it('rejects project deletion for non admin and non project manager users', async () => {
    const message = createMessage();
    const { handler, projectService } = createHandler();

    await handler.handleProjectCommand(['delete', 'delete-campus'], message, {
      dbUser: { id: 'dev-user', role: UserRole.DEV },
    } as never);

    expect(projectService.deleteProject).not.toHaveBeenCalled();
    expectReplyText(
      message as never,
      'Only administrators can delete projects.',
    );
  });

  it('deletes a project only after the confirm delete command', async () => {
    const message = createMessage();
    const { handler, projectService } = createHandler({
      projectService: {
        deleteProject: jest.fn().mockResolvedValue(true),
        findById: jest.fn().mockResolvedValue({
          id: 12,
          name: 'Delete Campus',
          slug: 'delete-campus',
        }),
      },
    });

    await handler.handleProjectCommand(['confirm', 'delete', '12'], message, {
      dbUser: { id: 'admin-user', role: UserRole.ADMIN },
    } as never);

    expect(projectService.deleteProject).toHaveBeenCalledWith(12);
    expectReplyText(message as never, 'Project **Delete Campus**');
    expectReplyText(message as never, 'was deleted');
  });
});
