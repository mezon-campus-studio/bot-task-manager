import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import TaskEntity from './task.entity';

@Injectable()
export class TaskService extends CRUDService<TaskEntity> {
  constructor(
    @InjectRepository(TaskEntity)
    private taskRepository: Repository<TaskEntity>,
  ) {
    super(taskRepository);
  }

  private async create(task: Partial<TaskEntity>) {
    const newTask = this.taskRepository.create(task);
    return this.taskRepository.save(newTask);
  }

  async createTask(payload: CreateTaskDto): Promise<TaskEntity> {
    return this.create({
      ...payload,
      code: payload.code || `TASK-${Date.now()}`,
    });
  }

  async updateTask(
    id: string,
    payload: UpdateTaskDto,
  ): Promise<TaskEntity | null> {
    const existingTask = await this.findById(id);

    if (!existingTask) {
      return null;
    }

    return this.taskRepository.save({
      ...existingTask,
      ...payload,
    });
  }

  async deleteTask(id: string): Promise<boolean> {
    const existingTask = await this.findById(id);

    if (!existingTask) {
      return false;
    }

    await this.taskRepository.softRemove(existingTask);
    return true;
  }

  async getTaskById(id: string): Promise<TaskEntity | null> {
    return this.findById(id);
  }

  async findByCode(code: string): Promise<TaskEntity | null> {
    return this.taskRepository.findOne({
      where: { code },
    });
  }

  async findById(id: string): Promise<TaskEntity | null> {
    return this.taskRepository.findOne({
      where: { id },
    });
  }
}
