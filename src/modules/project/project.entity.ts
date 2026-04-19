import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '@src/common/database/abstract.entity';
import UserEntity from '@src/modules/user/user.entity';
import { ProjectOnboardingStatus } from './project.enums';

@Entity('projects')
@Index('UQ_projects_slug', ['slug'], { unique: true })
@Index('IDX_projects_owner_user_id', ['ownerUserId'])
export default class ProjectEntity extends AbstractEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  slug!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid' })
  ownerUserId!: string;

  @Column({
    type: 'enum',
    enum: ProjectOnboardingStatus,
    default: ProjectOnboardingStatus.PENDING,
  })
  onboardingStatus!: ProjectOnboardingStatus;

  @Column({ type: 'timestamptz', nullable: true })
  onboardingCompletedAt!: Date | null;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId', referencedColumnName: 'id' })
  ownerUser!: UserEntity;
}
