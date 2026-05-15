import { UserRole } from '@src/common/enums/user.enum';
import { UserCommandHandler } from './user-command.handler';

describe(UserCommandHandler.name, () => {
  function expectReplyText(message: { reply: jest.Mock }, text: string): void {
    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          t: expect.stringContaining(text),
        }),
      }),
    );
  }

  function createMessage(senderId = 'mezon-owner') {
    return {
      raw: { content: { t: '*user info mezon-target' }, mentions: [] },
      reply: jest.fn().mockResolvedValue(undefined),
      senderId,
    } as never;
  }

  function createHandler(overrides?: {
    projectContextService?: Partial<Record<string, jest.Mock>>;
    userService?: Partial<Record<string, jest.Mock>>;
  }) {
    const userService = {
      findByIdentifier: jest.fn().mockResolvedValue({
        email: 'target@example.com',
        mezonId: 'mezon-target',
        name: 'Target User',
        role: UserRole.DEV,
        status: 'ACTIVE',
      }),
      upsertByMezonId: jest.fn(),
      ...overrides?.userService,
    };
    const projectContextService = {
      getRequiredCurrentProjectByMezonId: jest.fn().mockResolvedValue({
        project: {
          id: 7,
          name: 'Campus Core',
          ownerUserId: 'owner-user-id',
        },
        projectId: 7,
        user: { id: 'owner-user-id', mezonId: 'mezon-owner' },
      }),
      ...overrides?.projectContextService,
    };

    return {
      handler: new (UserCommandHandler as any)(
        userService,
        projectContextService,
      ) as UserCommandHandler,
      projectContextService,
      userService,
    };
  }

  it('lets the current project owner view detailed user info', async () => {
    const message = createMessage();
    const { handler, userService } = createHandler();

    await handler.handleUserCommand(['info', 'mezon-target'], message, {
      dbUser: { id: 'owner-user-id', role: UserRole.DEV },
      getClan: jest.fn().mockResolvedValue(null),
    } as never);

    expect(userService.findByIdentifier).toHaveBeenCalledWith(
      'mezon-target',
      true,
    );
    expectReplyText(message as never, 'Email: target@example.com');
  });

  it('blocks non-owner non-admin users from detailed user info', async () => {
    const message = createMessage('mezon-dev');
    const { handler, userService } = createHandler({
      projectContextService: {
        getRequiredCurrentProjectByMezonId: jest.fn().mockResolvedValue({
          project: {
            id: 7,
            name: 'Campus Core',
            ownerUserId: 'owner-user-id',
          },
          projectId: 7,
          user: { id: 'dev-user-id', mezonId: 'mezon-dev' },
        }),
      },
    });

    await handler.handleUserCommand(['info', 'mezon-target'], message, {
      dbUser: { id: 'dev-user-id', role: UserRole.DEV },
      getClan: jest.fn().mockResolvedValue(null),
    } as never);

    expect(userService.findByIdentifier).not.toHaveBeenCalled();
    expectReplyText(message as never, 'only available to administrators');
  });
});
