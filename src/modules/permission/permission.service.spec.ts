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
          key: 'projects.admin',
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
});
