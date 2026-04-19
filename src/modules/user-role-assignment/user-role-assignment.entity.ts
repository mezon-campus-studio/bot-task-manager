import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';

@Entity('user_role_assignments')
@Check(
  'user_role_assignments_scope_type_ck',
  `("scope_type" = 'SYSTEM' AND "project_id" IS NULL AND "team_id" IS NULL) OR ("scope_type" = 'PROJECT' AND "project_id" IS NOT NULL AND "team_id" IS NULL) OR ("scope_type" = 'TEAM' AND "team_id" IS NOT NULL)`,
)
@Index('user_role_assignments_system_scope_key', ['userId', 'roleId'], {
  unique: true,
  where: `"scope_type" = 'SYSTEM'`,
})
@Index(
  'user_role_assignments_project_scope_key',
  ['userId', 'roleId', 'projectId'],
  {
    unique: true,
    where: `"scope_type" = 'PROJECT' AND "project_id" IS NOT NULL AND "team_id" IS NULL`,
  },
)
@Index('user_role_assignments_team_scope_key', ['userId', 'roleId', 'teamId'], {
  unique: true,
  where: `"scope_type" = 'TEAM' AND "team_id" IS NOT NULL`,
})
export default class UserRoleAssignmentEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int' })
  roleId!: number;

  @Column({
    type: 'enum',
    enum: RoleScopeType,
  })
  scopeType!: RoleScopeType;

  @Column({ type: 'int', nullable: true })
  projectId!: number | null;

  @Column({ type: 'int', nullable: true })
  teamId!: number | null;

  @Column({ type: 'uuid', nullable: true })
  assignedByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
