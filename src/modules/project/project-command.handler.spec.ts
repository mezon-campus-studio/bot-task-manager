import { UserRole } from '@src/common/enums/user.enum';
import { ProjectCommandHandler } from './project-command.handler';

const mockRateLimiter = {
  isAllowed: jest.fn().mockReturnValue(true),
  shouldNotifyLimitExceeded: jest.fn().mockReturnValue(false),
};

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
        mockRateLimiter as never,
      ),
      projectContextService,
      projectService,
    };
  }

  it('lists available projects with ids and slugs', async () => {
    const message = createMessage();
    const { handler, projectService } = createHandler({
      projectService: {
        // Hãy đảm bảo hàm này trả về mảng dữ liệu mock của bạn giống như trước
        listAccessibleProjectsForUser: jest
          .fn()
          .mockResolvedValue([
            { id: 10, name: 'Backend Campus', slug: 'backend' },
          ]),
        findByOwnerUserId: jest
          .fn()
          .mockResolvedValue([
            { id: 10, name: 'Backend Campus', slug: 'backend' },
          ]),
        // Giữ nguyên listProjects cho trường hợp nếu cần, hoặc xóa đi
        listProjects: jest.fn().mockResolvedValue([
          { id: 10, name: 'Backend Campus', slug: 'backend' },
          { id: 11, name: 'Frontend Campus', slug: 'frontend' },
        ]),
      },
    });

    await handler.handleProjectCommand(['list'], message, {
      dbUser: { id: 'user-1', role: UserRole.DEV }, // User thường (DEV)
    } as never);

    // THAY ĐỔI TẠI ĐÂY: Kỳ vọng gọi hàm listAccessibleProjectsForUser thay vì listProjects
    expect(projectService.listAccessibleProjectsForUser).toHaveBeenCalledWith(
      'user-1',
    );
    expect(projectService.listAccessibleProjectsForUser).toHaveBeenCalledTimes(
      1,
    );

    expectReplyText(message as never, '[#10] ⭐ **Backend Campus**');
    expectReplyText(message as never, 'Slug : `backend`');
  });

  it('prints an empty-state message when no projects exist', async () => {
    const message = createMessage();
    const { handler } = createHandler({
      projectService: {
        listAccessibleProjectsForUser: jest.fn().mockResolvedValue([]),
        findByOwnerUserId: jest.fn().mockResolvedValue([]),
        listProjects: jest.fn().mockResolvedValue([]),
      },
    });

    await handler.handleProjectCommand(['list'], message, {
      dbUser: { id: 'user-1', role: UserRole.DEV },
    } as never);

    expectReplyText(message as never, 'No accessible projects found.');
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
      'Only **Administrators** can delete projects.',
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
    expectReplyText(message as never, '**Project Deleted**');
    expectReplyText(message as never, 'Name : Delete Campus');
  });
});
