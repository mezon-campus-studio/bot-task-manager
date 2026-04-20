import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@Controller('tasks')
@ApiTags('Tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async createTask(@Body() body: CreateTaskDto) {
    return this.taskService.createTask(body);
  }

  @Get(':id')
  async getTaskById(@Param('id') id: string) {
    return this.taskService.findById(Number(id));
  }

  @Patch(':id')
  async updateTask(@Param('id') id: string, @Body() body: UpdateTaskDto) {
    return this.taskService.updateTask(Number(id), body);
  }

  @Delete(':id')
  async deleteTask(@Param('id') id: string) {
    return this.taskService.deleteTask(Number(id));
  }
}
