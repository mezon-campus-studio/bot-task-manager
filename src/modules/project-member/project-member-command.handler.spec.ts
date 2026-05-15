import { UserRole } from '@src/common/enums/user.enum';
import { ProjectMemberCommandHandler } from './project-member-command.handler';
import { ProjectMemberStatus } from './project-member-status.enum';

describe(ProjectMemberCommandHandler.name, () => {
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
      raw: {
        content: { t: '*project-member invite @target' },
        mentions: [{ user_id: 'mezon-target', username: 'target' }],
      },
      reply: jest.fn().mockResolvedValue(undefined),
      senderId,
    } as never;
  }

  function createHandler(overrides?: {
    projectContextService?: Partial<Record<string, jest.Mock>>;
    projectMemberService?: Partial<Record<string, jest.Mock>>;
    userService?: Partial<Record<string, jest.Mock>>;
  }) {
    const context = {
      project: {
        id: 7,
        name: 'Campus Core',
        ownerUserId: 'owner-user-id',
        slug: 'campus-core',
      },
      projectId: 7,
      user: {
        id: 'owner-user-id',
        mezonId: 'mezon-owner',
        name: 'Owner',
        role: UserRole.DEV,
      },
    };
    const projectContextService = {
      getRequiredCurrentProjectByMezonId: jest.fn().mockResolvedValue(context),
      ...overrides?.projectContextService,
    };
    const projectMemberService = {
      inviteProjectMember: jest.fn(),
      listByProject: jest.fn(),
      removeProjectMember: jest.fn(),
      ...overrides?.projectMemberService,
    };
    const userService = {
      findByIdentifier: jest.fn(),
      ...overrides?.userService,
    };

    return {
      context,
      handler: new ProjectMemberCommandHandler(
        projectMemberService as never,
        projectContextService as never,
        userService as never,
      ),
      projectContextService,
      projectMemberService,
      userService,
    };
  }

  it('lists project members in the current project', async () => {
    const message = createMessage();
    const { handler, projectMemberService } = createHandler({
      projectMemberService: {
        listByProject: jest.fn().mockResolvedValue([
          {
            id: 2,
            status: ProjectMemberStatus.ACTIVE,
            user: { mezonId: 'mezon-dev', name: 'Dev One' },
            userId: 'dev-user-id',
          },
        ]),
      },
    });

    await handler.handleProjectMemberCommand(['list'], message, {
      dbUser: { role: UserRole.DEV },
    } as never);

    expect(projectMemberService.listByProject).toHaveBeenCalledWith(7);
    expectReplyText(message as never, 'Dev One');
    expectReplyText(message as never, 'ACTIVE');
  });

  it('lets the current project owner invite a resolved user', async () => {
    const message = createMessage();
    const { handler, projectMemberService, userService } = createHandler({
      projectMemberService: {
        inviteProjectMember: jest.fn().mockResolvedValue({
          status: ProjectMemberStatus.INVITED,
        }),
      },
      userService: {
        findByIdentifier: jest.fn().mockResolvedValue({
          id: 'target-user-id',
          mezonId: 'mezon-target',
          name: 'Target User',
        }),
      },
    });

    await handler.handleProjectMemberCommand(['invite', '@target'], message, {
      dbUser: { role: UserRole.DEV },
    } as never);

    expect(userService.findByIdentifier).toHaveBeenCalledWith('mezon-target');
    expect(projectMemberService.inviteProjectMember).toHaveBeenCalledWith({
      invitedByUserId: 'owner-user-id',
      projectId: 7,
      userId: 'target-user-id',
    });
    expectReplyText(message as never, 'Target User');
  });

  it('blocks non-owner project members from removing project members', async () => {
    const message = createMessage('mezon-dev');
    const { handler, projectMemberService } = createHandler({
      projectContextService: {
        getRequiredCurrentProjectByMezonId: jest.fn().mockResolvedValue({
          project: {
            id: 7,
            name: 'Campus Core',
            ownerUserId: 'owner-user-id',
          },
          projectId: 7,
          user: { id: 'dev-user-id', mezonId: 'mezon-dev', role: UserRole.DEV },
        }),
      },
    });

    await handler.handleProjectMemberCommand(['remove', '@target'], message, {
      dbUser: { role: UserRole.DEV },
    } as never);

    expect(projectMemberService.removeProjectMember).not.toHaveBeenCalled();
    expectReplyText(message as never, 'Only project owners or administrators');
  });
});
