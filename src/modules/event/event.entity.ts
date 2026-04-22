import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { AbstractEntity } from '@src/common/database/abstract.entity';
import { EventStatus } from './enums';

@Entity('events')
@Index('IDX_events_project_status_starts_at', [
  'projectId',
  'status',
  'startsAt',
])
@Index('IDX_events_project_team', ['projectId', 'teamId'])
@Index('IDX_events_owner_status', ['ownerUserId', 'status'])
export default class EventEntity extends AbstractEntity {
  @Column({
    type: 'int',
  })
  projectId!: number;

  @Column({
    type: 'int',
    nullable: true,
  })
  teamId!: number | null;

  @Column({
    type: 'uuid',
  })
  ownerUserId!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  title!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status!: EventStatus;

  @Column({
    type: 'timestamptz',
  })
  startsAt!: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  endsAt!: Date | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  location!: string | null;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt!: Date | null;
}
