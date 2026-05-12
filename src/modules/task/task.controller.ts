import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@src/modules/auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '@src/modules/project/guards/project-member.guard';
import { ProjectRoleGuard } from '@src/modules/project/guards/project-role.guard';
import { ProjectRoles } from '@src/modules/project/decorators/project-roles.decorator';
import { PROJECT_DEFAULT_ROLE_KEYS } from '@src/modules/project/constants/project-default-roles.constant';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@Controller('tasks')
@ApiTags('Tasks')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  async createTask(@Body() body: CreateTaskDto) {
    return this.taskService.createTask(body);
  }

  @Post('project/:projectId/task/:taskId/assignee')
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Assign task to a user' })
  async assignTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) id: number,
    @Body() body: AssignTaskDto,
  ) {
    return this.taskService.assignTask(id, body.assigneeUserId);
  }

  @Patch('project/:projectId/task/:taskId/assignee')
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Reassign task to another user' })
  async reassignTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) id: number,
    @Body() body: AssignTaskDto,
  ) {
    return this.taskService.reassignTask(id, body.assigneeUserId);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all tasks in a project' })
  async getTasksByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: QueryTasksDto,
  ) {
    return this.taskService.queryTasks(projectId, query);
  }

  @Get('project/:projectId/task/:taskId')
  @ApiOperation({ summary: 'Get task details' })
  async getTaskById(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) id: number,
  ) {
    return this.taskService.findById(id);
  }

  @Delete('project/:projectId/task/:taskId/assignee')
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Remove assignee from task' })
  async removeTaskAssignee(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) id: number,
  ) {
    return this.taskService.removeTaskAssignee(id);
  }

  @Delete('project/:projectId/task/:taskId')
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Delete a task' })
  async deleteTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) id: number,
  ) {
    return this.taskService.deleteTask(id);
  }

  @Patch('project/:projectId/task/:taskId/status')
  @ApiOperation({ summary: 'Update task status' })
  async updateTaskStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) id: number,
    @Body() body: UpdateTaskStatusDto,
  ) {
    return this.taskService.updateTaskStatus(id, body);
  }

  @Patch('project/:projectId/task/:taskId')
  @ApiOperation({ summary: 'Update task details' })
  async updateTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) id: number,
    @Body() body: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(id, body);
  }
}
