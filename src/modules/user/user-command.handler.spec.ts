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

  function createMessage(senderId = 'mezon-user-1') {
    return {
      raw: {
        content: {
          t: '',
        },
        mentions: [],
      },
      reply: jest.fn().mockResolvedValue(undefined),
      senderId,
    } as never;
  }

  function createHandler(overrides?: Partial<Record<string, jest.Mock>>) {
    const userService = {
      findByIdentifier: jest.fn(),
      findByMezonId: jest.fn(),
      softDeleteUser: jest.fn(),
      upsertByMezonId: jest.fn(),
      ...overrides,
    };

    return {
      handler: new UserCommandHandler(userService as never),
      userService,
    };
  }

  it('shows Administrator for admin users in user me', async () => {
    const message = createMessage();
    const { handler } = createHandler();

    await handler.handleUserCommand(['me'], message, {
      dbUser: {
        currentProjectId: null,
        email: 'admin@example.com',
        mezonId: 'mezon-admin',
        name: 'Admin User',
        role: String(UserRole.ADMIN),
        status: 'ACTIVE',
      },
    } as never);

    expectReplyText(message as never, 'Role: Administrator');
  });

  it('maps clan Administrator role to internal admin during user search refresh', async () => {
    const message = createMessage();
    const user = {
      email: 'admin@example.com',
      id: 'admin-id',
      mezonId: 'mezon-admin-search',
      name: 'Admin Search',
      role: UserRole.UK,
      status: 'ACTIVE',
    };
    const { handler, userService } = createHandler({
      findByIdentifier: jest.fn().mockResolvedValue(user),
      upsertByMezonId: jest.fn().mockResolvedValue({
        ...user,
        role: UserRole.ADMIN,
      }),
    });

    await handler.handleUserCommand(['search', 'mezon-admin-search'], message, {
      getClan: jest.fn().mockResolvedValue({
        listRoles: jest.fn().mockResolvedValue({
          roles: [
            {
              role_user_list: {
                role_users: [{ id: 'mezon-admin-search' }],
              },
              title: 'Administrator',
            },
          ],
        }),
      }),
    } as never);

    expect(userService.upsertByMezonId).toHaveBeenCalledWith(
      'mezon-admin-search',
      { role: UserRole.ADMIN },
    );
    expectReplyText(message as never, 'Role: Administrator');
  });

  it('keeps Administrator when a clan user also has a lower role', async () => {
    const message = createMessage();
    const user = {
      email: 'admin@example.com',
      id: 'admin-id',
      mezonId: 'mezon-admin-search',
      name: 'Admin Search',
      role: UserRole.UK,
      status: 'ACTIVE',
    };
    const { handler, userService } = createHandler({
      findByIdentifier: jest.fn().mockResolvedValue(user),
      upsertByMezonId: jest.fn().mockResolvedValue({
        ...user,
        role: UserRole.ADMIN,
      }),
    });

    await handler.handleUserCommand(['search', 'mezon-admin-search'], message, {
      getClan: jest.fn().mockResolvedValue({
        listRoles: jest.fn().mockResolvedValue({
          roles: [
            {
              role_user_list: {
                role_users: [{ id: 'mezon-admin-search' }],
              },
              title: 'Member',
            },
            {
              role_user_list: {
                role_users: [{ id: 'mezon-admin-search' }],
              },
              title: 'Administrator',
            },
          ],
        }),
      }),
    } as never);

    expect(userService.upsertByMezonId).toHaveBeenCalledWith(
      'mezon-admin-search',
      { role: UserRole.ADMIN },
    );
    expectReplyText(message as never, 'Role: Administrator');
  });

  it('downgrades an existing Administrator when clan search no longer finds a role for the user', async () => {
    const message = createMessage();
    const user = {
      email: 'admin@example.com',
      id: 'admin-id',
      mezonId: 'mezon-admin-search',
      name: 'Admin Search',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    };
    const { handler, userService } = createHandler({
      findByIdentifier: jest.fn().mockResolvedValue(user),
      upsertByMezonId: jest.fn().mockResolvedValue({
        ...user,
        role: UserRole.UK,
      }),
    });

    await handler.handleUserCommand(['search', 'mezon-admin-search'], message, {
      getClan: jest.fn().mockResolvedValue({
        listRoles: jest.fn().mockResolvedValue({
          roles: [
            {
              role_user_list: {
                role_users: [{ id: 'someone-else' }],
              },
              title: 'Administrator',
            },
          ],
        }),
      }),
    } as never);

    expect(userService.upsertByMezonId).toHaveBeenCalledWith(
      'mezon-admin-search',
      { role: UserRole.UK },
    );
    expectReplyText(message as never, 'Role: Member');
  });

  it('keeps an existing Administrator when clan search fails', async () => {
    const message = createMessage();
    const user = {
      email: 'admin@example.com',
      id: 'admin-id',
      mezonId: 'mezon-admin-search',
      name: 'Admin Search',
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    };
    const { handler, userService } = createHandler({
      findByIdentifier: jest.fn().mockResolvedValue(user),
      upsertByMezonId: jest.fn(),
    });

    await handler.handleUserCommand(['search', 'mezon-admin-search'], message, {
      getClan: jest.fn().mockResolvedValue({
        listRoles: jest.fn().mockRejectedValue(new Error('Mezon unavailable')),
      }),
    } as never);

    expect(userService.upsertByMezonId).not.toHaveBeenCalled();
    expectReplyText(message as never, 'Role: Administrator');
  });

  it('prepares user deletion and requires confirm delete before soft delete', async () => {
    const message = createMessage();
    const user = {
      email: 'delete@example.com',
      id: 'delete-user-id',
      mezonId: 'mezon-delete',
      name: 'Delete User',
      role: UserRole.UK,
      status: 'ACTIVE',
    };
    const { handler, userService } = createHandler({
      findByIdentifier: jest.fn().mockResolvedValue(user),
      softDeleteUser: jest.fn(),
    });

    await handler.handleUserCommand(['delete', 'mezon-delete'], message, {
      dbUser: {
        role: UserRole.ADMIN,
      },
    } as never);

    expect(userService.softDeleteUser).not.toHaveBeenCalled();
    expectReplyText(message as never, '*user confirm delete mezon-delete');
  });

  it('soft deletes a user only after confirm delete', async () => {
    const message = createMessage();
    const user = {
      email: 'delete@example.com',
      id: 'delete-user-id',
      mezonId: 'mezon-delete',
      name: 'Delete User',
      role: UserRole.UK,
      status: 'ACTIVE',
    };
    const { handler, userService } = createHandler({
      findByIdentifier: jest.fn().mockResolvedValue(user),
      softDeleteUser: jest.fn().mockResolvedValue(undefined),
    });

    await handler.handleUserCommand(
      ['confirm', 'delete', 'mezon-delete'],
      message,
      {
        dbUser: {
          role: UserRole.ADMIN,
        },
      } as never,
    );

    expect(userService.softDeleteUser).toHaveBeenCalledWith('mezon-delete');
    expectReplyText(message as never, 'was deleted');
  });
});
