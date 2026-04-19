import { createTestingModule, factory, testingModule } from '#jest';
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
      avatar: 'https://avatar.example.test/after.png',
      name: 'After Update',
    });

    expect(updatedUser).toMatchObject({
      id: originalUser.id,
      avatar: 'https://avatar.example.test/after.png',
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
    user.avatar = 'https://avatar.example.test/updated.png';

    await updateSession.save();

    await expect(
      userService.findByMezonId('crud-update-user'),
    ).resolves.toMatchObject({
      mezonId: 'crud-update-user',
      name: 'After Update',
      avatar: 'https://avatar.example.test/updated.png',
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
});
