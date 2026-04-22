import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import RolePermissionEntity from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';

describe(RolePermissionService.name, () => {
  let rolePermissionService: RolePermissionService;
  let rolePermissionRepository: Repository<RolePermissionEntity>;

  beforeAll(createTestingModule);

  beforeAll(() => {
    rolePermissionService = testingModule!.get(RolePermissionService);
    rolePermissionRepository = testingModule!
      .get(DataSource)
      .getRepository(RolePermissionEntity);
  });

  describe('createRolePermission', () => {
    it('should persist a role-permission link for the requested role and permission', async () => {
      const role = await factory.role({
        key: 'role-permission-create-role',
      });
      const permission = await factory.permission({
        key: 'role-permission-create-permission',
      });

      const rolePermission = await rolePermissionService.createRolePermission({
        permissionId: permission.id,
        roleId: role.id,
      });

      expect(rolePermission).toMatchObject({
        permissionId: permission.id,
        roleId: role.id,
      });

      await expect(
        rolePermissionRepository.findOneByOrFail({
          permissionId: permission.id,
          roleId: role.id,
        }),
      ).resolves.toMatchObject({
        permissionId: permission.id,
        roleId: role.id,
      });
    });

    it('should keep a single persisted link when the same role-permission pair is saved again', async () => {
      const rolePermission = await factory.rolePermission({});

      const duplicateRolePermission =
        await rolePermissionService.createRolePermission({
          permissionId: rolePermission.permissionId,
          roleId: rolePermission.roleId,
        });

      expect(duplicateRolePermission).toMatchObject({
        permissionId: rolePermission.permissionId,
        roleId: rolePermission.roleId,
      });
      await expect(rolePermissionRepository.count()).resolves.toBe(1);
    });
  });

  describe('findByRoleId', () => {
    it('should list only permission links for the requested role in ascending permission order', async () => {
      const role = await factory.role({
        key: 'role-permission-list-role',
      });
      const firstPermission = await factory.permission({
        action: 'read',
        key: 'role-permission-alpha',
        resource: 'project-alpha',
      });
      const secondPermission = await factory.permission({
        action: 'write',
        key: 'role-permission-beta',
        resource: 'project-beta',
      });

      await factory.rolePermission({
        permissionId: firstPermission.id,
        roleId: role.id,
      });
      await factory.rolePermission({
        permissionId: secondPermission.id,
        roleId: role.id,
      });
      await factory.rolePermission({
        permissionId: (
          await factory.permission({
            action: 'manage',
            key: 'role-permission-other-permission',
            resource: 'project-other',
          })
        ).id,
        roleId: (
          await factory.role({
            key: 'role-permission-other-role',
          })
        ).id,
      });

      const rolePermissions = await rolePermissionService.findByRoleId(role.id);

      expect(rolePermissions.map((entry) => entry.permissionId)).toEqual([
        firstPermission.id,
        secondPermission.id,
      ]);
    });
  });

  describe('findByPermissionId', () => {
    it('should list only role links for the requested permission in ascending role order', async () => {
      const permission = await factory.permission({
        action: 'read',
        key: 'role-permission-filter-permission',
        resource: 'project-filter',
      });
      const firstRole = await factory.role({
        key: 'role-permission-filter-alpha',
      });
      const secondRole = await factory.role({
        key: 'role-permission-filter-beta',
      });

      await factory.rolePermission({
        permissionId: permission.id,
        roleId: firstRole.id,
      });
      await factory.rolePermission({
        permissionId: permission.id,
        roleId: secondRole.id,
      });
      await factory.rolePermission({
        permissionId: (
          await factory.permission({
            action: 'manage',
            key: 'role-permission-filter-other-permission',
            resource: 'project-filter-other',
          })
        ).id,
        roleId: (
          await factory.role({
            key: 'role-permission-filter-other-role',
          })
        ).id,
      });

      const rolePermissions = await rolePermissionService.findByPermissionId(
        permission.id,
      );

      expect(rolePermissions.map((entry) => entry.roleId)).toEqual([
        firstRole.id,
        secondRole.id,
      ]);
    });
  });
  
  describe('deleteByRoleId', () => {
    it('should delete all role-permission links for the requested role', async () => {
      const role = await factory.role({
        key: 'role-permission-delete-role',
      });
      const permission = await factory.permission({
        key: 'role-permission-delete-permission',
      });

      await factory.rolePermission({
        permissionId: permission.id,
        roleId: role.id,
      });

      await rolePermissionService.deleteByRoleId(role.id);

      await expect(
        rolePermissionRepository.findOneBy({
          permissionId: permission.id,
          roleId: role.id,
        }),
      ).resolves.toBeNull();
    });
  });

  describe('deleteByPermissionId', () => {
    it('should delete all role-permission links for the requested permission', async () => {
      const permission = await factory.permission({
        key: 'role-permission-delete-permission-2',
      });
      const role = await factory.role({
        key: 'role-permission-delete-role-2',
      });

      await factory.rolePermission({
        permissionId: permission.id,
        roleId: role.id,
      });

      await rolePermissionService.deleteByPermissionId(permission.id);

      await expect(
        rolePermissionRepository.findOneBy({
          permissionId: permission.id,
          roleId: role.id,
        }),
      ).resolves.toBeNull();
    });
  });

    describe('removeRolePermission', () => {
    it('should delete the role-permission link for the requested role and permission', async () => {
      const role = await factory.role({
        key: 'role-permission-remove-role',
      });
      const permission = await factory.permission({
        key: 'role-permission-remove-permission',
      });

      await factory.rolePermission({
        permissionId: permission.id,
        roleId: role.id,
      });

      await rolePermissionService.removeRolePermission(role.id, permission.id);

      await expect(
        rolePermissionRepository.findOneBy({
          permissionId: permission.id,
          roleId: role.id,
        }),
      ).resolves.toBeNull();
    });
  });
});
