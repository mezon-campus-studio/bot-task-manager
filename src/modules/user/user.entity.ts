import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { UserRole } from '#src/common/enums/user.enum.js';
import { AbstractUuidEntity } from '@src/common/database/abstract.entity';
import { UserStatus } from './enum/user-status.enum';

@Entity('users')
@Index('UQ_users_mezon_id', ['mezonId'], { unique: true })
@Index('IDX_users_current_project_id', ['currentProjectId'])
export default class UserEntity extends AbstractUuidEntity {
  @Column({ type: 'varchar' })
  mezonId!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatar?: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    nullable: true,
    default: UserRole.UK,
  })
  role!: UserRole | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    nullable: true,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus | null;

  @Column({ type: 'varchar', nullable: true })
  currentProjectId?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt?: Date | null;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt?: Date | null;
}
