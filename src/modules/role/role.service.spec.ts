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

  describe('deleteRole', () => {
    it('should delete the role when the id exists and is not a system role', async () => {
      const role = await factory.role({
        key: 'deletable-role',
        scopeType: RoleScopeType.TEAM,
      });

      await expect(roleService.deleteRole(role.id)).resolves.toBeUndefined();
      await expect(
        roleRepository.findOneBy({ id: role.id }),
      ).resolves.toBeNull();
    });

    it('should reject deleting a system role', async () => {
      const role = await factory.role({
        key: 'system-role',
        scopeType: RoleScopeType.SYSTEM,
        isSystem: true,
      });

      await expect(roleService.deleteRole(role.id)).rejects.toThrow();
      await expect(
        roleRepository.findOneBy({ id: role.id }),
      ).resolves.toMatchObject({
        id: role.id,
        key: 'system-role',
        scopeType: RoleScopeType.SYSTEM,
        isSystem: true,
      });
    });

    it('should reject deleting a non-existent role', async () => {
      await expect(roleService.deleteRole(999_999)).rejects.toThrow();
    });
  });

  describe('updateRole', () => {
    it('should update the role name and description', async () => {
      const role = await factory.role({
        key: 'updatable-role',
        scopeType: RoleScopeType.TEAM,
        name: 'Updatable Role',
        description: 'Old description',
      });

      const updatedRole = await roleService.updateRole(role.id, {
        name: 'Updated Role',
        description: 'New description',
      });

      expect(updatedRole).toMatchObject({
        id: role.id,
        key: 'updatable-role',
        scopeType: RoleScopeType.TEAM,
        name: 'Updated Role',
        description: 'New description',
      });

      await expect(
        roleRepository.findOneBy({ id: role.id }),
      ).resolves.toMatchObject({
        id: role.id,
        key: 'updatable-role',
        scopeType: RoleScopeType.TEAM,
        name: 'Updated Role',
        description: 'New description',
      });
    });

    it('should update only the fields provided in the updates object', async () => {
      const role = await factory.role({
        key: 'partially-updatable-role',
        scopeType: RoleScopeType.TEAM,
        name: 'Partially Updatable Role',
        description: 'Initial description',
      });

      const updatedRole = await roleService.updateRole(role.id, {
        description: 'Only description updated',
      });

      expect(updatedRole).toMatchObject({
        id: role.id,
        key: 'partially-updatable-role',
        scopeType: RoleScopeType.TEAM,
        name: 'Partially Updatable Role',
        description: 'Only description updated',
      });

      await expect(
        roleRepository.findOneBy({ id: role.id }),
      ).resolves.toMatchObject({
        id: role.id,
        key: 'partially-updatable-role',
        scopeType: RoleScopeType.TEAM,
        name: 'Partially Updatable Role',
        description: 'Only description updated',
      });
    });

    it('should reject updating a non-existent role', async () => {
      const fristRole = await factory.role({
        key: 'existing-role',
        scopeType: RoleScopeType.TEAM,
      });

      await factory.role({
        key: 'another-existing-role',
        scopeType: RoleScopeType.TEAM,
      });

      await expect(
        roleService.updateRole(999_999, { name: 'Non-existent Role' }),
      ).rejects.toThrow();

      await expect(
        roleRepository.findOneBy({ id: fristRole.id }),
      ).resolves.toMatchObject({
        id: fristRole.id,
        key: 'existing-role',
        scopeType: RoleScopeType.TEAM,
      });
    });

    it('should reject updating a role to have a duplicate key', async () => {
      const firstRole = await factory.role({
        key: 'original-role',
        scopeType: RoleScopeType.TEAM,
      });

      await factory.role({
        key: 'existing-role',
      });

      await expect(
        roleService.updateRole(firstRole.id, { key: 'existing-role' }),
      ).rejects.toThrow();

      await expect(
        roleRepository.findOneBy({ id: firstRole.id }),
      ).resolves.toMatchObject({
        id: firstRole.id,
        key: 'original-role',
        scopeType: RoleScopeType.TEAM,
      });
    });
  });

  describe('findAll', () => {
    it('should list all roles in ascending id order', async () => {
      const firstRole = await factory.role({
        key: 'list-all-role-alpha',
        scopeType: RoleScopeType.PROJECT,
      });
      const secondRole = await factory.role({
        key: 'list-all-role-beta',
        scopeType: RoleScopeType.SYSTEM,
      });

      const roles = await roleService.findAll();

      expect(roles.map((role) => role.id)).toEqual(
        expect.arrayContaining([firstRole.id, secondRole.id]),
      );
    });
  });
});
