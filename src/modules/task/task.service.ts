import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import { ProjectMemberService } from '@src/modules/project-member/project-member.service';
import { TeamMemberStatus } from '@src/modules/team-member/enums/team-member-status.enum';
import { TeamMemberService } from '@src/modules/team-member/team-member.service';
import { TaskStatus } from './enums';
import TaskEntity from './task.entity';

export type CreateTaskInput = Pick<
  TaskEntity,
  'projectId' | 'reporterUserId' | 'title'
> &
  Partial<
    Pick<
      TaskEntity,
      | 'teamId'
      | 'assigneeUserId'
      | 'description'
      | 'status'
      | 'priority'
      | 'dueAt'
    >
  >;

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type UpdateTaskStatusInput = Pick<TaskEntity, 'status'>;

@Injectable()
export class TaskService extends CRUDService<TaskEntity> {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private taskRepository: Repository<TaskEntity>,
    private readonly projectMemberService: ProjectMemberService,
    private readonly teamMemberService: TeamMemberService,
  ) {
    super(taskRepository);
  }

  private async getTaskForStatusUpdate(
    taskId: number,
  ): Promise<TaskEntity | null> {
    this.logger.log({
      log: 'Attempting to get task for status update',
      taskId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    this.logger.log({
      log: 'Got task for status update',
      taskId,
      task,
    });

    return task;
  }

  private validateTaskStatusTransition(
    currentStatus: TaskStatus,
    nextStatus: TaskStatus,
  ): void {
    this.logger.log({
      currentStatus,
      log: 'Attempting to validate task status transition',
      nextStatus,
    });

    const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.CANCELLED],
      [TaskStatus.DONE]: [],
      [TaskStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      this.logger.log({
        currentStatus,
        log: 'Task status transition validation failed',
        nextStatus,
      });

      throw new Error(
        `Task status cannot transition from ${currentStatus} to ${nextStatus}`,
      );
    }

    this.logger.log({
      currentStatus,
      log: 'Task status transition validation passed',
      nextStatus,
    });
  }

  private async validateTaskAssigneeContext(
    task: TaskEntity,
    assigneeUserId: string,
  ): Promise<void> {
    this.logger.log({
      log: 'Attempting to validate task assignee context',
      assigneeUserId,
      projectId: task.projectId,
      taskId: task.id,
      teamId: task.teamId,
    });

    if (task.teamId != null) {
      const membership = await this.teamMemberService.findMembership(
        task.teamId,
        assigneeUserId,
      );

      if (membership == null || membership.status !== TeamMemberStatus.ACTIVE) {
        this.logger.log({
          assigneeUserId,
          log: 'Task assignee validation failed because team membership is not active',
          status: membership?.status ?? null,
          taskId: task.id,
          teamId: task.teamId,
        });

        throw new Error('Task assignee must be an active team member');
      }

      this.logger.log({
        assigneeUserId,
        log: 'Task assignee validation passed for team member',
        membershipId: membership.id,
        taskId: task.id,
        teamId: task.teamId,
      });

      return;
    }

    const membership = await this.projectMemberService.findByProjectAndUser(
      task.projectId,
      assigneeUserId,
    );

    if (
      membership == null ||
      membership.status !== ProjectMemberStatus.ACTIVE
    ) {
      this.logger.log({
        assigneeUserId,
        log: 'Task assignee validation failed because project membership is not active',
        projectId: task.projectId,
        status: membership?.status ?? null,
        taskId: task.id,
      });

      throw new Error('Task assignee must be an active project member');
    }

    this.logger.log({
      assigneeUserId,
      log: 'Task assignee validation passed for project member',
      membershipId: membership.id,
      projectId: task.projectId,
      taskId: task.id,
    });
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

  async updateTaskStatus(
    taskId: number,
    input: UpdateTaskStatusInput,
  ): Promise<TaskEntity | null> {
    this.logger.log({
      log: 'Attempting to update task status',
      taskId,
      input,
    });

    const task = await this.getTaskForStatusUpdate(taskId);

    if (!task) {
      this.logger.log({
        log: 'Task not found for status update',
        taskId,
        input,
      });

      return null;
    }

    this.validateTaskStatusTransition(task.status, input.status);

    task.status = input.status;

    const result = await this.taskRepository.save(task);

    this.logger.log({
      log: 'Task status update result',
      taskId,
      result,
    });

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

    if (assigneeUserId != null) {
      await this.validateTaskAssigneeContext(task, assigneeUserId);
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

  async reassignTask(
    taskId: number,
    assigneeUserId: string,
  ): Promise<TaskEntity | null> {
    this.logger.log({
      log: 'Attempting to reassign task',
      taskId,
      assigneeUserId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    this.logger.log({ log: 'Got task for reassignment', taskId, task });

    if (!task) {
      this.logger.log({
        log: 'Task not found for reassignment',
        taskId,
        assigneeUserId,
      });

      return null;
    }

    if (task.assigneeUserId == null) {
      this.logger.log({
        assigneeUserId,
        log: 'Task reassignment failed because task has no current assignee',
        taskId,
      });

      throw new Error('Task has no assignee to replace');
    }

    await this.validateTaskAssigneeContext(task, assigneeUserId);

    task.assigneeUserId = assigneeUserId;

    const result = await this.taskRepository.save(task);
    this.logger.log({
      log: 'Task reassignment result',
      taskId,
      assigneeUserId,
      result,
    });

    return result;
  }

  async removeTaskAssignee(taskId: number): Promise<TaskEntity | null> {
    this.logger.log({
      log: 'Attempting to remove task assignee',
      taskId,
    });

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
    });

    this.logger.log({ log: 'Got task for assignee removal', taskId, task });

    if (!task) {
      this.logger.log({
        log: 'Task not found for assignee removal',
        taskId,
      });

      return null;
    }

    if (task.assigneeUserId == null) {
      this.logger.log({
        log: 'Task assignee removal skipped because task already has no assignee',
        taskId,
      });

      return task;
    }

    task.assigneeUserId = null;

    const result = await this.taskRepository.save(task);
    this.logger.log({
      log: 'Task assignee removal result',
      taskId,
      result,
    });

    return result;
  }
}
