import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '#src/common/enums/user.enum.js';
import {
  Args,
  AutoContext,
  Command,
  ManagedMessage,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';
import { ProjectContextService } from '@src/modules/project/project-context.service';
import { UserService } from '@src/modules/user/user.service';
import { TaskStatus } from './enums';
import { TaskService } from './task.service';
import type TaskEntity from './task.entity';

@Injectable()
@UseGuards(NezonAuthGuard)
export class TaskCommandHandler {
  private readonly logger = new Logger(TaskCommandHandler.name);

  constructor(
    private readonly taskService: TaskService,
    private readonly projectContextService: ProjectContextService,
    private readonly userService: UserService,
  ) {}

  @Command('task')
  async handleTaskCommand(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
  ): Promise<void> {
    const action = args[0]?.toLowerCase();
    const senderId = message.senderId;

    if (!senderId) {
      await this.reply(message, 'Cannot resolve command sender.');
      return;
    }

    try {
      switch (action) {
        case 'list':
          await this.listTasks(senderId, message);
          return;
        case 'create':
          await this.createTask(args, senderId, message);
          return;
        case 'detail':
        case 'info':
          await this.showTask(args, senderId, message);
          return;
        case 'status':
          await this.updateStatus(args, senderId, message);
          return;
        case 'assign':
          await this.assignTask(args, senderId, message);
          return;
        case 'delete':
          await this.deleteTask(args, senderId, message);
          return;
        case 'confirm':
          if (args[1]?.toLowerCase() === 'delete') {
            await this.confirmDeleteTask(args, senderId, message);
            return;
          }
          await this.reply(message, 'Usage: `*task confirm delete <id>`');
          return;
        default:
          await this.reply(
            message,
            [
              '🧩 **Task Commands:**',
              '  `*task list` - List tasks in current project',
              '  `*task create <title...>` - Create a task',
              '  `*task detail <id>` - View task detail',
              '  `*task status <id> <todo|in_progress|done|cancelled>` - Update status',
              '  `*task assign <id> <userId|@username>` - Assign task',
              '  `*task delete <id>` - Prepare delete confirmation',
              '  `*task confirm delete <id>` - Confirm task deletion',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Task command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listTasks(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    const tasks = await this.taskService.listByProject(context.projectId);

    if (!tasks.length) {
      await this.reply(
        message,
        `No tasks found in project **${context.project.name}**.`,
      );
      return;
    }

    const lines = tasks.map((task) => {
      const assignee = task.assigneeUser
        ? ` - assignee: ${task.assigneeUser.name}`
        : '';
      return `  [#${task.id}] ${task.title} - ${task.status}${assignee}`;
    });

    await this.reply(
      message,
      [`🧩 Tasks in **${context.project.name}**:`, ...lines].join('\n'),
    );
  }

  private async createTask(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const title = args.slice(1).join(' ').trim();

    if (!title) {
      await this.reply(message, 'Usage: `*task create <title...>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const task = await this.taskService.createTask({
      projectId: context.projectId,
      reporterUserId: context.user.id,
      title,
    });

    await this.reply(
      message,
      `✅ Created task **#${task.id}: ${task.title}**.`,
    );
  }

  private async showTask(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const taskId = this.parseId(args[1]);

    if (taskId == null) {
      await this.reply(message, 'Usage: `*task detail <id>`');
      return;
    }

    const task = await this.getTaskInCurrentProject(taskId, senderId);

    if (!task) {
      await this.reply(
        message,
        `Task #${taskId} not found in current project.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `**Task #${task.id}**`,
        `Title: ${task.title}`,
        `Status: ${task.status}`,
        `Priority: ${task.priority ?? 'N/A'}`,
        `Reporter: ${task.reporterUser.name ?? task.reporterUser.mezonId}`,
        `Assignee: ${task.assigneeUser?.name ?? task.assigneeUser?.mezonId}`,
        task.description ? `Description: ${task.description}` : null,
      ]
        .filter((line): line is string => line != null)
        .join('\n'),
    );
  }

  private async updateStatus(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const taskId = this.parseId(args[1]);
    const status = this.parseStatus(args[2]);

    if (taskId == null || status == null) {
      await this.reply(
        message,
        'Usage: `*task status <id> <todo|in_progress|done|cancelled>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    const existingTask = await this.findTaskInProject(
      taskId,
      context.projectId,
    );

    if (!existingTask) {
      await this.reply(
        message,
        `Task #${taskId} not found in current project.`,
      );
      return;
    }

    const dbUser = context.user;
    if (!this.hasTaskPermission(dbUser, existingTask)) {
      await this.reply(
        message,
        `You don't have permission to update status of task #${taskId}.`,
      );
      return;
    }

    const updatedTask = await this.taskService.updateTaskStatus(taskId, {
      authorUserId: context.user.id,
      status,
    });

    if (!updatedTask) {
      await this.reply(message, `Task #${taskId} not found.`);
      return;
    }

    await this.reply(
      message,
      `✅ Task #${updatedTask.id} status updated to **${updatedTask.status}**.`,
    );
  }

  private async assignTask(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const taskId = this.parseId(args[1]);
    const rawIdentifier = args[2];

    if (taskId == null || !rawIdentifier) {
      await this.reply(
        message,
        'Usage: `*task assign <id> <userId|@username>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    const existingTask = await this.findTaskInProject(
      taskId,
      context.projectId,
    );

    if (!existingTask) {
      await this.reply(
        message,
        `Task #${taskId} not found in current project.`,
      );
      return;
    }

    const targetIdentifier =
      this.getMentionedUserIdentifier(rawIdentifier, message) ??
      rawIdentifier.replace(/^@/, '').trim();
    const targetUser =
      await this.userService.findByIdentifier(targetIdentifier);

    if (!targetUser) {
      await this.reply(message, `User **${rawIdentifier}** not found.`);
      return;
    }

    const dbUser = context.user;
    if (!this.canAssignTask(dbUser, targetUser.id)) {
      await this.reply(
        message,
        `You don't have permission to assign task #${taskId} to **${targetUser.name ?? targetUser.mezonId}**
        \nYou can only assign tasks to yourself or to users with the appropriate permissions.`,
      );
      return;
    }

    const task = await this.taskService.assignTask(taskId, targetUser.id);

    if (!task) {
      await this.reply(message, `Task #${taskId} not found.`);
      return;
    }

    await this.reply(
      message,
      `✅ Assigned task #${task.id} to **${targetUser.name ?? targetUser.mezonId}**.`,
    );
  }

  private async deleteTask(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const taskId = this.parseId(args[1]);

    if (taskId == null) {
      await this.reply(message, 'Usage: `*task delete <id>`');
      return;
    }

    const existingTask = await this.getTaskInCurrentProject(taskId, senderId);

    if (!existingTask) {
      await this.reply(
        message,
        `Task #${taskId} not found in current project.`,
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    if (!this.isProjectManagerOrAdmin(context.user)) {
      await this.reply(
        message,
        `You don't have permission to delete task #${taskId}.
        \nYou can only delete tasks if you are the project manager or an administrator.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `🗑️ Are you sure you want to delete task **#${existingTask.id}: ${existingTask.title}**?`,
        `Run: \`*task confirm delete ${existingTask.id}\` to complete the deletion.`,
      ].join('\n'),
    );
  }

  private async confirmDeleteTask(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const taskId = this.parseId(args[2]);

    if (taskId == null) {
      await this.reply(message, 'Usage: `*task confirm delete <id>`');
      return;
    }

    const existingTask = await this.getTaskInCurrentProject(taskId, senderId);

    if (!existingTask) {
      await this.reply(
        message,
        `Task #${taskId} not found in current project.`,
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    if (!this.isProjectManagerOrAdmin(context.user)) {
      await this.reply(
        message,
        `You don't have permission to delete task #${taskId}.
        \nYou can only delete tasks if you are the project manager or an administrator.`,
      );
      return;
    }

    const deleted = await this.taskService.deleteTask(taskId);

    if (!deleted) {
      await this.reply(message, `Task #${taskId} not found.`);
      return;
    }

    await this.reply(message, `🗑️ Deleted task #${taskId}.`);
  }

  private async getTaskInCurrentProject(
    taskId: number,
    senderId: string,
  ): Promise<TaskEntity | null> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    return this.findTaskInProject(taskId, context.projectId);
  }

  private async findTaskInProject(
    taskId: number,
    projectId: number,
  ): Promise<TaskEntity | null> {
    const task = await this.taskService.findById(taskId);

    if (!task || task.projectId !== projectId) {
      return null;
    }

    return task;
  }

  private isProjectManagerOrAdmin(
    dbUser: { role?: unknown } | null | undefined,
  ): boolean {
    const role = Number(dbUser?.role);
    return role === UserRole.PM || role === UserRole.ADMIN;
  }

  private hasTaskPermission(
    dbUser: { id?: unknown; role?: unknown } | null | undefined,
    task: { assigneeUserId: string | null },
  ): boolean {
    if (!dbUser?.id) return false;

    const userId = String(dbUser.id);

    const isAssignee =
      task.assigneeUserId != null && task.assigneeUserId === userId;

    return this.isProjectManagerOrAdmin(dbUser) || isAssignee;
  }

  private canAssignTask(
    dbUser: { id?: unknown; role?: unknown } | null | undefined,
    targetAssigneeId: string, // ID của người ĐƯỢC chỉ định gán trong dòng lệnh
  ): boolean {
    if (!dbUser?.id) return false;

    const currentUserId = String(dbUser.id);

    // Điều kiện 1: Là PM hoặc Admin -> Có quyền gán cho bất kỳ ai
    const isLead = this.isProjectManagerOrAdmin(dbUser);

    // Điều kiện 2: Tự gán cho chính mình (Self-assign)
    const isSelfAssign = currentUserId === targetAssigneeId;

    return isLead || isSelfAssign;
  }

  private parseId(value: string | undefined): number | null {
    if (!value) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private parseStatus(value: string | undefined): TaskStatus | null {
    const normalized = value?.trim().toLowerCase();

    switch (normalized) {
      case 'todo':
      case 'to-do':
        return TaskStatus.TODO;
      case 'in_progress':
      case 'in-progress':
      case 'progress':
        return TaskStatus.IN_PROGRESS;
      case 'done':
        return TaskStatus.DONE;
      case 'cancelled':
      case 'canceled':
        return TaskStatus.CANCELLED;
      default:
        return null;
    }
  }

  private getMentionedUserIdentifier(
    identifier: string,
    message: ManagedMessage,
  ): string | null {
    const normalized = identifier.trim();
    if (!normalized.startsWith('@')) {
      return null;
    }

    const mentionName = normalized.slice(1).trim().toLowerCase();
    if (!mentionName) {
      return null;
    }

    const raw = message.raw as any;
    const mentions = Array.isArray(raw?.mentions) ? raw.mentions : [];
    const contentText = String(raw?.content?.t || '').trim();

    const matched = mentions.find((item: any) => {
      const candidateValues = [
        item.user_id,
        item.id,
        item.username,
        item.display_name,
        item.name,
        item.user_name,
      ]
        .filter(Boolean)
        .map((itemValue: any) => String(itemValue).trim().toLowerCase())
        .map((itemValue: string) =>
          itemValue.startsWith('@') ? itemValue.slice(1) : itemValue,
        );

      if (
        typeof item.s === 'number' &&
        typeof item.e === 'number' &&
        contentText.length >= item.e
      ) {
        const rangeText = String(contentText.slice(item.s, item.e))
          .trim()
          .toLowerCase();
        if (rangeText) {
          candidateValues.push(
            rangeText.startsWith('@') ? rangeText.slice(1) : rangeText,
          );
        }
      }

      return candidateValues.includes(mentionName);
    });

    return matched?.user_id || matched?.id || null;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (
        response != null &&
        typeof response === 'object' &&
        'message' in response
      ) {
        const message = response.message;

        if (Array.isArray(message)) {
          return message.join(', ');
        }

        if (typeof message === 'string') {
          return message;
        }
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Task command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
