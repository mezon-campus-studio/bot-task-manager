import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import { NezonAuthGuard } from './nezon-auth.guard';

describe(NezonAuthGuard.name, () => {
  function createRpcContext(data: unknown): ExecutionContext {
    return {
      getType: jest.fn().mockReturnValue('rpc'),
      switchToRpc: jest.fn().mockReturnValue({
        getData: jest.fn().mockReturnValue(data),
      }),
    } as unknown as ExecutionContext;
  }

  it('keeps existing Administrator role when clan role lookup is unknown', async () => {
    const dbUser = {
      id: 'user-1',
      mezonId: 'mezon-admin',
      role: UserRole.ADMIN,
    };
    const userService = {
      findByMezonId: jest.fn().mockResolvedValue(dbUser),
      upsertByMezonId: jest.fn(),
    };
    const nezonContext = {
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
      message: {
        sender_id: 'mezon-admin',
      },
    };
    const guard = new NezonAuthGuard(userService as never);

    const result = await guard.canActivate(createRpcContext(nezonContext));

    expect(result).toBe(true);
    expect(userService.upsertByMezonId).not.toHaveBeenCalled();
    expect((nezonContext as any).dbUser).toBe(dbUser);
  });
});
