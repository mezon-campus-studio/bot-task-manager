import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from '@src/common/database/abstract.entity';
import ProjectEntity from '@src/modules/project/project.entity';
import UserEntity from '@src/modules/user/user.entity';
import { ProjectMemberStatus } from './project-member-status.enum';

@Entity('project_members')
@Index('UQ_project_members_project_id_user_id', ['projectId', 'userId'], {
  unique: true,
})
@Index('IDX_project_members_user_id', ['userId'])
@Index('IDX_project_members_invited_by_user_id', ['invitedByUserId'])
export default class ProjectMemberEntity extends AbstractEntity {
  @Column({ type: 'int' })
  projectId!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: ProjectMemberStatus,
    default: ProjectMemberStatus.INVITED,
  })
  status!: ProjectMemberStatus;

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  joinedAt!: Date | null;

  @ManyToOne(() => ProjectEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId', referencedColumnName: 'id' })
  project!: ProjectEntity;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user!: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invitedByUserId', referencedColumnName: 'id' })
  invitedByUser!: UserEntity | null;
}
