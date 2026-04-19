import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { RoleScopeType } from './enums/role-scope-type.enum';
import RoleEntity from './role.entity';
import { RoleService } from './role.service';

describe(RoleService.name, () => {
  let roleService: RoleService;
  let roleRepository: Repository<RoleEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    roleService = testingModule!.get(RoleService);
    roleRepository = testingModule!.get(DataSource).getRepository(RoleEntity);
  });

  describe('createRole', () => {
    it('should persist a role with a nullable description and a false system flag by default', async () => {
      const role = await roleService.createRole({
        key: 'project-admin',
        name: 'Project Admin',
        scopeType: RoleScopeType.PROJECT,
      });

      expect(role).toMatchObject({
        description: null,
        isSystem: false,
        key: 'project-admin',
        name: 'Project Admin',
        scopeType: RoleScopeType.PROJECT,
      });

      await expect(
        roleRepository.findOneByOrFail({ id: role.id }),
      ).resolves.toMatchObject({
        description: null,
        isSystem: false,
        key: 'project-admin',
        name: 'Project Admin',
        scopeType: RoleScopeType.PROJECT,
      });
    });

    it('should reject creating a second role with the same key', async () => {
      await factory.role({
        key: 'system-owner',
      });

      await expect(
        roleService.createRole({
          key: 'system-owner',
          name: 'System Owner Duplicate',
          scopeType: RoleScopeType.SYSTEM,
        }),
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should return the persisted role when the id exists', async () => {
      const role = await factory.role({
        key: 'role-find-by-id',
        scopeType: RoleScopeType.TEAM,
      });

      await expect(roleService.findById(role.id)).resolves.toMatchObject({
        id: role.id,
        key: 'role-find-by-id',
        scopeType: RoleScopeType.TEAM,
      });
    });

    it('should return null when the role id does not exist', async () => {
      await expect(roleService.findById(999_999)).resolves.toBeNull();
    });
  });

  describe('findByKey', () => {
    it('should return the role when the key already exists', async () => {
      const role = await factory.role({
        key: 'team-viewer',
        scopeType: RoleScopeType.TEAM,
      });

      await expect(roleService.findByKey('team-viewer')).resolves.toMatchObject(
        {
          id: role.id,
          key: 'team-viewer',
          scopeType: RoleScopeType.TEAM,
        },
      );
    });

    it('should return null when the key is still available', async () => {
      await expect(
        roleService.findByKey('missing-role-key'),
      ).resolves.toBeNull();
    });
  });

  describe('findByScopeType', () => {
    it('should list only roles for the requested scope in ascending id order', async () => {
      const firstRole = await factory.role({
        key: 'project-role-alpha',
        scopeType: RoleScopeType.PROJECT,
      });
      const secondRole = await factory.role({
        key: 'project-role-beta',
        scopeType: RoleScopeType.PROJECT,
      });

      await factory.role({
        key: 'system-role-outside',
        scopeType: RoleScopeType.SYSTEM,
      });

      const roles = await roleService.findByScopeType(RoleScopeType.PROJECT);

      expect(roles.map((role) => role.id)).toEqual([
        firstRole.id,
        secondRole.id,
      ]);
    });
  });
});
