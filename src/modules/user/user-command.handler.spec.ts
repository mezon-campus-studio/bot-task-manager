import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createTestingModule, factory, testingModule } from '#jest';
import { UserRole } from '@src/common/enums/user.enum';
import { Cache } from 'cache-manager';
import { UserCommandHandler } from './user-command.handler';
import { UserService } from './user.service';

describe(UserCommandHandler.name, () => {
  let handler: UserCommandHandler;
  let cacheManager: Cache;
  let userService: UserService;

  beforeAll(createTestingModule);

  beforeAll(() => {
    handler = testingModule!.get(UserCommandHandler);
    cacheManager = testingModule!.get<Cache>(CACHE_MANAGER);
    userService = testingModule!.get(UserService);
  });

  afterEach(async () => {
    // Clear any keys set during tests
    // cache-manager v5+ removed .reset(); use .store.reset() or clear individual keys
    if (cacheManager && typeof (cacheManager as any).store?.reset === 'function') {
      await (cacheManager as any).store.reset();
    }
  });

  describe('delete and confirmDelete', () => {
    it('requires a user delete request to be set in cache before user confirm delete succeeds', async () => {
      const user = await factory.user({
        mezonId: 'delete-target-user',
        name: 'Target User',
        email: 'target-user@example.com',
      });

      const replySpy = jest.fn();
      const mockMessage = {
        reply: replySpy,
        senderId: 'admin-sender-id',
        raw: {
          mentions: [],
          content: { t: '*user delete target-user@example.com' },
        },
      } as any;

      const mockCtx = {
        dbUser: {
          role: UserRole.ADMIN,
        },
      } as any;

      // 1. Calling confirm delete directly should fail
      const confirmDeleteArgsDirect = [
        'confirm',
        'delete',
        'target-user@example.com',
      ];
      await handler.handleUserCommand(
        confirmDeleteArgsDirect,
        mockMessage,
        mockCtx,
      );

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            t: expect.stringContaining(
              'No pending deletion request found.\nPlease run *user delete first.',
            ),
          }),
        }),
      );

      replySpy.mockClear();

      // 2. Run delete command first
      const deleteArgs = ['delete', 'target-user@example.com'];
      await handler.handleUserCommand(deleteArgs, mockMessage, mockCtx);

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            t: expect.stringContaining('Are you sure you want to delete user'),
          }),
        }),
      );

      // Verify key was set in cache
      const cacheKey = `pending_delete:${user.id}`;
      const cacheVal = await cacheManager.get(cacheKey);
      expect(cacheVal).toBe('true');

      replySpy.mockClear();

      // 3. Run confirm delete now, should succeed
      const confirmDeleteArgs = [
        'confirm',
        'delete',
        'target-user@example.com',
      ];
      await handler.handleUserCommand(confirmDeleteArgs, mockMessage, mockCtx);

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            t: expect.stringContaining('was deleted.'),
          }),
        }),
      );

      // Verify key was removed from cache
      const cacheValAfter = await cacheManager.get(cacheKey);
      expect(cacheValAfter).toBeUndefined();

      // Verify user was soft deleted in DB
      const deletedUser = await userService.findByIdentifier(
        'target-user@example.com',
        true,
      );
      expect(deletedUser?.deletedAt).toBeInstanceOf(Date);
    });

    it('rejects confirmation if pending delete request has expired', async () => {
      const user = await factory.user({
        mezonId: 'delete-expired-user',
        name: 'Expired Target User',
        email: 'expired-user@example.com',
      });

      const replySpy = jest.fn();
      const mockMessage = {
        reply: replySpy,
        senderId: 'admin-sender-id',
        raw: {
          mentions: [],
          content: { t: '*user delete expired-user@example.com' },
        },
      } as any;

      const mockCtx = {
        dbUser: {
          role: UserRole.ADMIN,
        },
      } as any;

      // Run delete command
      const deleteArgs = ['delete', 'expired-user@example.com'];
      await handler.handleUserCommand(deleteArgs, mockMessage, mockCtx);

      // Manually delete cache key to simulate expiration
      const cacheKey = `pending_delete:${user.id}`;
      await cacheManager.del(cacheKey);

      replySpy.mockClear();

      // Run confirm delete
      const confirmDeleteArgs = [
        'confirm',
        'delete',
        'expired-user@example.com',
      ];
      await handler.handleUserCommand(confirmDeleteArgs, mockMessage, mockCtx);

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            t: expect.stringContaining(
              'No pending deletion request found.\nPlease run *user delete first.',
            ),
          }),
        }),
      );
    });
  });

  describe('search (INFO-018: clan-scoped)', () => {
    it('returns user when they are a member of the current clan', async () => {
      await factory.user({
        mezonId: 'clan-member-001',
        name: 'Clan Member',
        email: 'clan-member@example.com',
      });

      const replySpy = jest.fn();
      const mockMessage = {
        reply: replySpy,
        senderId: 'requester-id',
        raw: { mentions: [], content: { t: '*user search clan-member-001' } },
      } as any;

      const mockCtx = {
        dbUser: { role: UserRole.DEV },
        getClan: jest.fn().mockResolvedValue({
          listMembers: jest.fn().mockResolvedValue({
            clan_members: [{ user_id: 'clan-member-001' }],
          }),
        }),
      } as any;

      await handler.handleUserCommand(
        ['search', 'clan-member-001'],
        mockMessage,
        mockCtx,
      );

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            t: expect.stringContaining('Search Result'),
          }),
        }),
      );
    });

    it('returns not-found when user exists but is outside the current clan', async () => {
      await factory.user({
        mezonId: 'outsider-user-001',
        name: 'Outside User',
        email: 'outside@example.com',
      });

      const replySpy = jest.fn();
      const mockMessage = {
        reply: replySpy,
        senderId: 'requester-id',
        raw: { mentions: [], content: { t: '*user search outsider-user-001' } },
      } as any;

      // Clan does NOT include 'outsider-user-001'
      const mockCtx = {
        dbUser: { role: UserRole.DEV },
        getClan: jest.fn().mockResolvedValue({
          listMembers: jest.fn().mockResolvedValue({
            clan_members: [{ user_id: 'some-other-member' }],
          }),
        }),
      } as any;

      await handler.handleUserCommand(
        ['search', 'outsider-user-001'],
        mockMessage,
        mockCtx,
      );

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            t: expect.stringContaining('not found in this clan'),
          }),
        }),
      );
    });

    it('falls back to global search when clan API is unavailable', async () => {
      await factory.user({
        mezonId: 'global-fallback-user',
        name: 'Fallback User',
        email: 'fallback@example.com',
      });

      const replySpy = jest.fn();
      const mockMessage = {
        reply: replySpy,
        senderId: 'requester-id',
        raw: {
          mentions: [],
          content: { t: '*user search global-fallback-user' },
        },
      } as any;

      // getClan throws — should gracefully fall back to global search
      const mockCtx = {
        dbUser: { role: UserRole.DEV },
        getClan: jest.fn().mockRejectedValue(new Error('Clan API unavailable')),
      } as any;

      await handler.handleUserCommand(
        ['search', 'global-fallback-user'],
        mockMessage,
        mockCtx,
      );

      // Falls back → user found via global search
      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            t: expect.stringContaining('Search Result'),
          }),
        }),
      );
    });
  });
});
