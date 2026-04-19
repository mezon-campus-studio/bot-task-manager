import { Column, Entity, Index } from 'typeorm';
import { AbstractUuidEntity } from '@src/common/database/abstract.entity';

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
  avatar!: string | null;

  @Column({ type: 'int', nullable: true })
  currentProjectId!: number | null;
}
