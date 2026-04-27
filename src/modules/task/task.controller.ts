import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
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

  @Post(':id/assignee')
  async assignTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignTaskDto,
  ) {
    return this.taskService.assignTask(id, body.assigneeUserId);
  }

  @Patch(':id/assignee')
  async reassignTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignTaskDto,
  ) {
    return this.taskService.reassignTask(id, body.assigneeUserId);
  }

  @Get(':id')
  async getTaskById(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.findById(id);
  }

  @Delete(':id/assignee')
  async removeTaskAssignee(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.removeTaskAssignee(id);
  }

  @Delete(':id')
  async deleteTask(@Param('id', ParseIntPipe) id: number) {
    return this.taskService.deleteTask(id);
  }

  @Patch(':id/status')
  async updateTaskStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTaskStatusDto,
  ) {
    return this.taskService.updateTaskStatus(id, body);
  }

  @Patch(':id')
  async updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(id, body);
  }
}
