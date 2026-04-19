import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { AbstractEntity } from '@src/common/database/abstract.entity';
import { TaskPriority, TaskStatus } from './enums';

@Entity('tasks')
@Index('IDX_tasks_project_status', ['projectId', 'status'])
@Index('IDX_tasks_project_team', ['projectId', 'teamId'])
@Index('IDX_tasks_assignee_status', ['assigneeUserId', 'status'])
@Index('IDX_tasks_reporter', ['reporterUserId'])
export default class TaskEntity extends AbstractEntity {
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
    nullable: true,
  })
  assigneeUserId!: string | null;

  @Column({
    type: 'uuid',
  })
  reporterUserId!: string;

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
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status!: TaskStatus;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority!: TaskPriority;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  dueAt!: Date | null;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt!: Date | null;
}
