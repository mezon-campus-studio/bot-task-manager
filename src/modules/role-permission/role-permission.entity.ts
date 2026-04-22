import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('role_permissions')
@Index(
  'role_permissions_role_id_permission_id_key',
  ['roleId', 'permissionId'],
  {
    unique: true,
  },
)
export default class RolePermissionEntity {
  @PrimaryColumn({ type: 'int' })
  roleId!: number;

  @PrimaryColumn({ type: 'int' })
  permissionId!: number;
}
