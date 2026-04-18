import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AbstractAuditEntity } from '@src/common/database/abstract.entity';
import { TaskPriority, TaskStatus, TaskType } from './task.enum';

@Entity('tasks')
export default class TaskEntity extends AbstractAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({
    type: 'enum',
    enum: TaskType,
    enumName: 'task_type_enum',
    default: TaskType.TASK,
  })
  type: TaskType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status_enum',
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    enumName: 'task_priority_enum',
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
