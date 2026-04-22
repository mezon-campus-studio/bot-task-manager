import { createTestingModule, factory, testingModule } from '#jest';
import { UserStatus } from './enum/user-status.enum';
import { UserService } from './user.service';
import type UserEntity from './user.entity';

describe(UserService.name, () => {
  let userService: UserService;

  beforeAll(createTestingModule);

  beforeAll(() => {
    userService = testingModule!.get(UserService);
  });

  it('returns an empty list when no identifiers are provided', async () => {
    await expect(userService.getManyByIdsAndUsernames({})).resolves.toEqual([]);
  });

  it('returns users matched by internal ids and mezon ids in one lookup', async () => {
    const internalUser = await factory.user({
      email: 'internal-user@example.com',
      mezonId: 'lookup-internal-user',
      name: 'Internal User',
    });
    const mezonUser = await factory.user({
      email: 'mezon-user@example.com',
      mezonId: 'lookup-mezon-user',
      name: 'Mezon User',
    });

    const result = await userService.getManyByIdsAndUsernames({
      ids: [internalUser.id],
      mezonIds: [mezonUser.mezonId],
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: internalUser.id,
          mezonId: 'lookup-internal-user',
        }),
        expect.objectContaining({
          id: mezonUser.id,
          mezonId: 'lookup-mezon-user',
        }),
      ]),
    );
  });

  it('creates a uuid-backed user when the mezon id does not exist', async () => {
    const user = await userService.upsertByMezonId('user-1', {
      email: 'first@example.com',
      name: 'First User',
    });

    expect(user).toMatchObject({
      id: expect.any(String),
      mezonId: 'user-1',
      email: 'first@example.com',
      name: 'First User',
    });
  });

  it('starts each test with a clean database state', async () => {
    await expect(userService.findByMezonId('user-1')).resolves.toBeNull();
  });

  it('finds a user by the internal uuid identity', async () => {
    const user = await factory.user({
      email: 'uuid-lookup@example.com',
      mezonId: 'uuid-lookup-user',
      name: 'UUID Lookup User',
    });

    await expect(userService.findById(user.id)).resolves.toMatchObject({
      id: user.id,
      mezonId: 'uuid-lookup-user',
    });
  });

  it('finds a user by email', async () => {
    const user = await factory.user({
      email: 'email-lookup@example.com',
      mezonId: 'email-lookup-user',
      name: 'Email Lookup User',
    });

    await expect(
      userService.findByEmail('email-lookup@example.com'),
    ).resolves.toMatchObject({
      id: user.id,
      mezonId: 'email-lookup-user',
    });
  });

  it('returns null when no account uses the requested email', async () => {
    await expect(
      userService.findByEmail('missing-user@example.com'),
    ).resolves.toBeNull();
  });

  it('updates an existing user when upserting the same mezon id', async () => {
    const originalUser = await userService.upsertByMezonId('user-update', {
      email: 'before@example.com',
      name: 'Before Update',
    });

    const updatedUser = await userService.upsertByMezonId('user-update', {
      name: 'After Update',
    });

    expect(updatedUser).toMatchObject({
      id: originalUser.id,
      email: 'before@example.com',
      mezonId: 'user-update',
      name: 'After Update',
    });
  });

  it('supports updateSession from CRUD base', async () => {
    const user = await factory.user({
      email: 'crud-update@example.com',
      mezonId: 'crud-update-user',
      name: 'Before Update',
    });

    const updateSession = userService.updateSession(user);
    user.name = 'After Update';

    await updateSession.save();

    await expect(
      userService.findByMezonId('crud-update-user'),
    ).resolves.toMatchObject({
      mezonId: 'crud-update-user',
      name: 'After Update',
    } satisfies Partial<UserEntity>);
  });

  it('supports updateEntry from CRUD base', async () => {
    const user = await factory.user({
      email: 'crud-entry@example.com',
      mezonId: 'crud-entry-user',
      name: 'Entry Before',
    });

    await userService.updateEntry(user, {
      name: 'Entry After',
    });

    await expect(
      userService.findByMezonId('crud-entry-user'),
    ).resolves.toMatchObject({
      mezonId: 'crud-entry-user',
      name: 'Entry After',
    } satisfies Partial<UserEntity>);
  });

  describe('findByIdentifier', () => {
    it('Find user with mezonId', async () => {
      const user = await factory.user({ mezonId: 'mezon-unique-01' });

      const result = await userService.findByIdentifier('mezon-unique-01');

      expect(result).toMatchObject({ id: user.id, mezonId: 'mezon-unique-01' });
    });

    it('Find user with email', async () => {
      const user = await factory.user({
        email: 'identifier-email@example.com',
      });

      const result = await userService.findByIdentifier(
        'identifier-email@example.com',
      );

      expect(result).toMatchObject({
        id: user.id,
        email: 'identifier-email@example.com',
      });
    });

    it('Find user with name', async () => {
      const user = await factory.user({ name: 'Username' });

      const result = await userService.findByIdentifier('Username');

      expect(result).toMatchObject({ id: user.id, name: 'Username' });
    });
  });

  it('return do nothing when no account uses to soft delete', async () => {
    await expect(
      userService.softDeleteUser('identifier-email@example.com'),
    ).resolves.toBeUndefined();
  });

  it('return do nothing when account status is deleted', async () => {
    await factory.user({
      name: 'User Deleted',
      mezonId: 'Mezon-123',
      status: UserStatus.DELETED,
      deletedAt: new Date(),
    });

    await expect(
      userService.softDeleteUser('User Deleted'),
    ).resolves.toBeUndefined();

    const checkUser = await userService.findByIdentifier('User Deleted', true);
    expect(checkUser?.status).toBe(UserStatus.DELETED);
  });

  it('soft delete run success', async () => {
    const user = await factory.user({
      mezonId: 'Mezon-123',
      name: 'Identifier name',
      email: 'identifier-email@example.com',
      status: UserStatus.ACTIVE,
      deletedAt: null,
    });

    await expect(
      userService.softDeleteUser('Identifier name'),
    ).resolves.toBeUndefined();

    const updateUser = await userService.findByIdentifier('Mezon-123', true);
    expect(updateUser).toMatchObject({
      id: user.id,
      status: UserStatus.DELETED,
    });

    expect(updateUser?.deletedAt).toBeInstanceOf(Date);
  });

  it('return do nothing when no account uses to restore', async () => {
    await expect(
      userService.restoreUser('Restore username'),
    ).resolves.toBeUndefined();
  });

  it('return do nothing when account want to restore have status is active or inactive', async () => {
    await factory.user({
      mezonId: 'Mezon-123',
      name: 'Identifier name',
      email: 'identifier-email@example.com',
      status: UserStatus.ACTIVE,
    });

    await expect(userService.restoreUser('Mezon-123')).resolves.toBeUndefined();
    const checkUser = await userService.findByIdentifier('Mezon-123');
    expect(checkUser?.status).toBe(UserStatus.ACTIVE);
  });

  it('restore user succes, from DELETED to ACTIVE', async () => {
    const user = await factory.user({
      mezonId: 'Mezon-123',
      name: 'Identifier name',
      email: 'identifier-email@example.com',
      status: UserStatus.DELETED,
      deletedAt: new Date(),
    });

    await expect(userService.restoreUser('Mezon-123')).resolves.toBeUndefined();

    const restoreUser = await userService.findByIdentifier('Mezon-123');
    expect(restoreUser).toMatchObject({
      id: user.id,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    });
  });

  it('return do nothing when no account update status', async () => {
    await expect(
      userService.updateStatusUser('Mezon-123', UserStatus.ACTIVE),
    ).resolves.toBeUndefined();
  });

  it('return do nothing when account update to deleted', async () => {
    await factory.user({
      mezonId: 'Mezon-123',
      status: UserStatus.ACTIVE,
    });

    await expect(
      userService.updateStatusUser('Mezon-123', UserStatus.DELETED),
    ).resolves.toBeUndefined();

    const checkUser = await userService.findByIdentifier('Mezon-123');
    expect(checkUser?.status).toBe(UserStatus.ACTIVE);
  });

  it('update user status run success', async () => {
    await factory.user({
      mezonId: 'Mezon-123',
      status: UserStatus.INACTIVE,
    });

    await expect(
      userService.updateStatusUser('Mezon-123', UserStatus.ACTIVE),
    ).resolves.toBeUndefined();

    const checkUser = await userService.findByIdentifier('Mezon-123');
    expect(checkUser?.status).toBe(UserStatus.ACTIVE);
  });
});
