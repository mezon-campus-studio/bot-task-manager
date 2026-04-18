import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import TaskEntity from './task.entity';

@Injectable()
export class TaskService extends CRUDService<TaskEntity> {
  constructor(
    @InjectRepository(TaskEntity)
    private taskRepository: Repository<TaskEntity>,
  ) {
    super(taskRepository);
  }

  async createEntry(task: Partial<TaskEntity>): Promise<TaskEntity> {
    const newTask = this.taskRepository.create(task);
    return this.taskRepository.save(newTask);
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
