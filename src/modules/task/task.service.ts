import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import TaskEntity from './task.entity';

export type CreateTaskInput = Pick<
  TaskEntity,
  | 'projectId'
  | 'teamId'
  | 'assigneeUserId'
  | 'reporterUserId'
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'dueAt'
>;

export type UpdateTaskInput = Partial<CreateTaskInput>;

@Injectable()
export class TaskService extends CRUDService<TaskEntity> {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private taskRepository: Repository<TaskEntity>,
  ) {
    super(taskRepository);
  }

  async createTask(input: CreateTaskInput): Promise<TaskEntity> {
    this.logger.log({ log: 'Attempting to create task', input });
    const task = this.taskRepository.create(input);
    this.logger.log({ log: 'Got task draft for creation', task });

    const result = await this.taskRepository.save(task);
    this.logger.log({ log: 'Task create result', result });

    return result;
  }

  async listByProject(projectId: number): Promise<TaskEntity[]> {
    this.logger.log({ log: 'Attempting to list tasks by project', projectId });

    const result = await this.taskRepository.find({
      where: { projectId },
      order: {
        dueAt: 'ASC',
        id: 'DESC',
      },
    });

    this.logger.log({
      log: 'Got tasks by project result',
      projectId,
      count: result.length,
      taskIds: result.map(({ id }) => id),
    });

    return result;
  }

  async findById(id: number): Promise<TaskEntity | null> {
    this.logger.log({ log: 'Attempting to find task by id', taskId: id });

    const result = await this.taskRepository.findOne({
      where: { id },
    });

    this.logger.log({ log: 'Got task by id result', taskId: id, result });

    return result;
  }

  async updateTask(
    taskId: number,
    input: UpdateTaskInput,
  ): Promise<TaskEntity | null> {
    this.logger.log({
      log: 'Attempting to update task',
      taskId,
      input,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    this.logger.log({ log: 'Got task for update', taskId, task });

    if (!task) {
      this.logger.log({ log: 'Task not found for update', taskId });
      return null;
    }

    Object.assign(task, input);

    const result = await this.taskRepository.save(task);
    this.logger.log({ log: 'Task update result', taskId, result });

    return result;
  }

  async deleteTask(taskId: number): Promise<boolean> {
    this.logger.log({ log: 'Attempting to delete task', taskId });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    this.logger.log({ log: 'Got task for delete', taskId, task });

    if (!task) {
      this.logger.log({ log: 'Task not found for delete', taskId });
      return false;
    }

    await this.taskRepository.softRemove(task);
    this.logger.log({ log: 'Task delete result', taskId });

    return true;
  }

  async assignTask(
    taskId: number,
    assigneeUserId: string | null,
  ): Promise<TaskEntity | null> {
    this.logger.log({
      log: 'Attempting to assign task',
      taskId,
      assigneeUserId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    this.logger.log({ log: 'Got task for assignment', taskId, task });

    if (!task) {
      this.logger.log({
        log: 'Task not found for assignment',
        taskId,
        assigneeUserId,
      });
      return null;
    }

    task.assigneeUserId = assigneeUserId;

    const result = await this.taskRepository.save(task);
    this.logger.log({
      log: 'Task assignment result',
      taskId,
      assigneeUserId,
      result,
    });

    return result;
  }
}
