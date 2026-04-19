import RolePermissionEntity from '@src/modules/role-permission/role-permission.entity';
import { Factory } from './factory';
import { permission } from './permission';
import { role } from './role';

export const rolePermission = Factory.forEntity<RolePermissionEntity>(
  RolePermissionEntity,
  async (input) => {
    const roleId = input.roleId ?? (await role({})).id;
    const permissionId = input.permissionId ?? (await permission({})).id;

    return {
      permissionId,
      roleId,
      ...input,
    };
  },
);
