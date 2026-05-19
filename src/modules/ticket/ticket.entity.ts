import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from '@src/common/database/abstract.entity';
import { TicketSeverity, TicketStatus } from './enums';
import UserEntity from '../user/user.entity';

@Entity('tickets')
@Index('IDX_tickets_project_status', ['projectId', 'status'])
@Index('IDX_tickets_project_team', ['projectId', 'teamId'])
@Index('IDX_tickets_assignee_status', ['assigneeUserId', 'status'])
@Index('IDX_tickets_reporter', ['reporterUserId'])
export default class TicketEntity extends AbstractEntity {
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
    name: 'assignee_user_id',
    nullable: true,
  })
  assigneeUserId!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignee_user_id' })
  assigneeUser!: UserEntity | null;

  @Column({
    type: 'uuid',
    name: 'reporter_user_id',
  })
  reporterUserId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_user_id' })
  reporterUser!: UserEntity;

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
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status!: TicketStatus;

  @Column({
    type: 'enum',
    enum: TicketSeverity,
    default: TicketSeverity.MEDIUM,
  })
  severity!: TicketSeverity;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt!: Date | null;
}
