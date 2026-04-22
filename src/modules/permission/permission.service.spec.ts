import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import PermissionEntity from './permission.entity';
import { PermissionService } from './permission.service';

describe(PermissionService.name, () => {
  let permissionService: PermissionService;
  let permissionRepository: Repository<PermissionEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    permissionService = testingModule!.get(PermissionService);
    permissionRepository = testingModule!
      .get(DataSource)
      .getRepository(PermissionEntity);
  });

  describe('createPermission', () => {
    it('should persist a permission with a nullable description when the caller omits it', async () => {
      const permission = await permissionService.createPermission({
        action: 'read',
        key: 'projects.read',
        resource: 'projects',
      });

      expect(permission).toMatchObject({
        action: 'read',
        description: null,
        key: 'projects.read',
        resource: 'projects',
      });

      await expect(
        permissionRepository.findOneByOrFail({ id: permission.id }),
      ).resolves.toMatchObject({
        action: 'read',
        description: null,
        key: 'projects.read',
        resource: 'projects',
      });
    });

    it('should reject creating a second permission with the same resource and action', async () => {
      await factory.permission({
        action: 'manage',
        key: 'projects.manage',
        resource: 'projects',
      });

      await expect(
        permissionService.createPermission({
          action: 'manage',
          key: 'projects.manage',
          resource: 'projects',
        }),
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should return the persisted permission when the id exists', async () => {
      const permission = await factory.permission({
        key: 'teams.invite',
      });

      await expect(
        permissionService.findById(permission.id),
      ).resolves.toMatchObject({
        id: permission.id,
        key: 'teams.invite',
      });
    });

    it('should return null when the permission id does not exist', async () => {
      await expect(permissionService.findById(999_999)).resolves.toBeNull();
    });
  });

  describe('findByKey', () => {
    it('should return the permission when the key already exists', async () => {
      const permission = await factory.permission({
        key: 'notes.write',
      });

      await expect(
        permissionService.findByKey('notes.write'),
      ).resolves.toMatchObject({
        action: permission.action,
        id: permission.id,
        key: 'notes.write',
        resource: permission.resource,
      });
    });

    it('should return null when the key is still available', async () => {
      await expect(
        permissionService.findByKey('missing.permission'),
      ).resolves.toBeNull();
    });
  });

  describe('updatePermission', () => {
    it('should update the permission when the id exists', async () => {
      const permission = await factory.permission({
        key: 'projects.update',
      });

      await permissionService.updatePermission(permission.id, {
        description: 'Updated description',
      });

      await expect(
        permissionRepository.findOneByOrFail({ id: permission.id }),
      ).resolves.toMatchObject({
        id: permission.id,
        key: 'projects.update',
        description: 'Updated description',
      });
    });

    it('should reject updating a non-existent permission', async () => {
      await expect(
        permissionService.updatePermission(999_999, {
          description: 'Updated description',
        }),
      ).rejects.toThrow();
    });
  });

  describe('deleteById', () => {
    it('should delete the permission when the id exists', async () => {
      const permission = await factory.permission({
        key: 'notes.delete',
      });

      await permissionService.deleteById(permission.id);

      await expect(
        permissionRepository.findOneBy({ id: permission.id }),
      ).resolves.toBeNull();
    });

    it('should resolve successfully when the permission id does not exist', async () => {
      await expect(permissionService.deleteById(999_999)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return all permissions', async () => {
      const firstPermission = await factory.permission({
        key: 'permission.find-all-1',
        action: 'read',
        resource: 'permission.find-all',
      });
      const secondPermission = await factory.permission({
        key: 'permission.find-all-2',
        action: 'read',
        resource: 'permission.find-all-1',
      });

      await expect(permissionService.findAll()).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: firstPermission.id,
            key: 'permission.find-all-1',
          }),
          expect.objectContaining({
            id: secondPermission.id,
            key: 'permission.find-all-2',
          }),
        ]),
      );
    });
  });
});
