import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '@src/common/database/abstract.entity';
import { NoteResourceType } from './enums';
import UserEntity from '../user/user.entity';

@Entity('notes')
@Index('IDX_notes_project_author', ['projectId', 'authorUserId'])
@Index('IDX_notes_project_resource', [
  'projectId',
  'resourceType',
  'resourceId',
])
@Index('IDX_notes_resource', ['resourceType', 'resourceId'])
export default class NoteEntity extends AbstractEntity {
  @Column({
    type: 'int',
  })
  projectId!: number;

  @Column({
    type: 'uuid',
    name: 'author_user_id',
  })
  authorUserId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_user_id' })
  authorUser!: UserEntity;

  @Column({
    type: 'boolean',
    default: false,
  })
  isPinned: boolean;

  @Column({
    type: 'boolean',
    default: true,
  })
  isShared: boolean;

  @Column({
    type: 'enum',
    enum: NoteResourceType,
  })
  resourceType!: NoteResourceType;

  @Column({
    type: 'varchar',
  })
  resourceId!: string;

  @Column({
    type: 'text',
  })
  content!: string;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt!: Date | null;
}
