import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '#src/common/enums/user.enum.js';
import { buildPaginationFooter } from '@src/common/utils/pagination.util';
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
          await this.listTasks(args, senderId, message);
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
              `┌─────────────────────────────`,
              `│ 🧩 **Task Commands**`,
              `├─────────────────────────────`,
              `│ \`*task list [--page N] [--status <s>] [--q <kw>]\`  – List tasks`,
              `│ \`*task create <title> [--desc <description>]\`       – Create a task`,
              `│ \`*task detail <id>\`                                 – View task detail`,
              `│ \`*task status <id> <status>\`                        – Update status`,
              `│ \`*task assign <id> <userId|@username>\`              – Assign task`,
              `│ \`*task delete <id>\`                                 – Prepare deletion`,
              `│ \`*task confirm delete <id>\`                         – Confirm deletion`,
              `├─────────────────────────────`,
              `│ Statuses: \`todo | in_progress | done | cancelled\``,
              `└─────────────────────────────`,
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Task command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listTasks(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    let page = this.parseFlagNumber(args, '--page', 0);
    if (page === 0) {
      page = Math.max(1, parseInt(args[1] ?? '1', 10) || 1);
    }
    const statusRaw = this.parseFlagString(args, '--status');
    const keyword = this.parseFlagString(args, '--q');
    const status = statusRaw ? this.parseStatus(statusRaw) : undefined;

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const {
      result: tasks,
      total,
      pageSize,
    } = await this.taskService.queryTasks(context.projectId, {
      page,
      take: 10,
      ...(status != null ? { status } : {}),
      ...(keyword ? { q: keyword } : {}),
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const meta = {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    // Build filter hint
    const activeFilters: string[] = [];
    if (status) activeFilters.push(`status: **${status}**`);
    if (keyword) activeFilters.push(`keyword: **"${keyword}"**`);

    const lines: string[] = [
      `┌─────────────────────────────`,
      `│ 🧩 **Task List**`,
      `├─────────────────────────────`,
      `│ 📁 Project : ${context.project.name}`,
      ...(activeFilters.length
        ? [`│ 🔎 Filter  : ${activeFilters.join('  •  ')}`]
        : []),
      `├─────────────────────────────`,
    ];

    if (!tasks.length) {
      lines.push(`│ ℹ️  No tasks found.`);
      lines.push(`│ Use \`*task create <title>\` to create one.`);
    } else {
      const STATUS_ICON: Record<string, string> = {
        [TaskStatus.TODO]: '⬜',
        [TaskStatus.IN_PROGRESS]: '🔵',
        [TaskStatus.DONE]: '✅',
        [TaskStatus.CANCELLED]: '🚫',
      };

      const PRIORITY_ICON: Record<string, string> = {
        low: '🟢',
        medium: '🟡',
        high: '🔴',
      };

      for (const task of tasks) {
        const statusIcon = STATUS_ICON[task.status] ?? '❓';
        const priorityIcon = task.priority
          ? (PRIORITY_ICON[String(task.priority).toLowerCase()] ?? '⚪')
          : '⚪';
        const assignee =
          task.assigneeUser?.name ?? task.assigneeUser?.mezonId ?? '—';
        const dueTag = task.dueAt ? `  📅 ${this.formatDate(task.dueAt)}` : '';

        lines.push(`│ ${statusIcon} **#${task.id}** ${task.title}`);
        lines.push(
          `│    ${priorityIcon} Priority : ${task.priority ?? '—'}   👤 Assignee : ${assignee}${dueTag}`,
        );
      }
    }

    // Build pagination command base with existing flags
    const flagSuffix = [
      status ? `--status ${statusRaw}` : '',
      keyword ? `--q ${keyword}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    const paginationCmd = `*task list${flagSuffix ? ` ${flagSuffix}` : ''}`;

    lines.push(`├─────────────────────────────`);
    lines.push(`│ ${buildPaginationFooter(meta, paginationCmd)}`);
    lines.push(`│ 💡 \`*task detail <id>\` to view details`);
    lines.push(`└─────────────────────────────`);

    await this.reply(message, lines.join('\n'));
  }

  private async createTask(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const raw = args.slice(1).join(' ').trim();

    if (!raw) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ❌ **Missing required fields**`,
          `├─────────────────────────────`,
          `│ Usage: \`*task create <title> [--desc <description>]\``,
          `│ Example: \`*task create Fix login bug --desc Page crashes on submit\``,
          `│ \`*task create <title> [--desc <description>]\`  – Create a task`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
      return;
    }

    // Tách title và description qua flag --desc
    const descIndex = raw.indexOf('--desc');
    let title: string;
    let description: string | undefined;

    if (descIndex !== -1) {
      title = raw.slice(0, descIndex).trim();
      description = raw.slice(descIndex + 6).trim() || undefined;
    } else {
      title = raw;
    }

    if (!title) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ❌ **Title is required**`,
          `├─────────────────────────────`,
          `│ Usage: \`*task create <title> [--desc <description>]\``,
          `└─────────────────────────────`,
        ].join('\n'),
      );
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
      description,
    });

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ✅ **Task Created**`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${task.id}`,
        `│ 📝  Title    : ${task.title}`,
        `│ ⬜  Status   : ${task.status}`,
        `│ 👤  Reporter : ${context.user.name ?? context.user.mezonId}`,
        `│ 📁  Project  : ${context.project.name}`,
        task.description
          ? `│ 📄  Desc     : ${task.description}`
          : `│ 📄  Desc     : —`,
        `├─────────────────────────────`,
        `│ 💡 \`*task assign ${task.id} @user\` to assign`,
        `└─────────────────────────────`,
      ].join('\n'),
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
        `❌ Task **#${taskId}** not found in current project.`,
      );
      return;
    }

    const STATUS_ICON: Record<string, string> = {
      [TaskStatus.TODO]: '⬜',
      [TaskStatus.IN_PROGRESS]: '🔵',
      [TaskStatus.DONE]: '✅',
      [TaskStatus.CANCELLED]: '🚫',
    };

    const PRIORITY_ICON: Record<string, string> = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
    };

    const statusIcon = STATUS_ICON[task.status] ?? '❓';
    const priorityIcon = task.priority
      ? (PRIORITY_ICON[String(task.priority).toLowerCase()] ?? '⚪')
      : '⚪';

    const lines: string[] = [
      `┌─────────────────────────────`,
      `│ 🧩 **Task Detail**`,
      `├─────────────────────────────`,
      `│ 🆔  ID        : #${task.id}`,
      `│ 📝  Title     : ${task.title}`,
      `│ ${statusIcon}  Status    : ${task.status}`,
      `│ ${priorityIcon}  Priority  : ${task.priority ?? '—'}`,
      `│ 👤  Reporter  : ${task.reporterUser?.name ?? task.reporterUser?.mezonId ?? '—'}`,
      `│ 👤  Assignee  : ${task.assigneeUser?.name ?? task.assigneeUser?.mezonId ?? '—'}`,
    ];

    if (task.dueAt) {
      lines.push(`│ 📅  Due       : ${this.formatDate(task.dueAt)}`);
    }

    if (task.description) {
      lines.push(`│ 📄  Desc      : ${task.description}`);
    }

    lines.push(`│ 📅  Created   : ${this.formatDate(task.createdAt)}`);
    lines.push(`│ 🔄  Updated   : ${this.formatDate(task.updatedAt)}`);
    lines.push(`├─────────────────────────────`);
    lines.push(
      `│ 💡 \`*task status ${task.id} <todo|in_progress|done|cancelled>\``,
    );
    lines.push(`└─────────────────────────────`);

    await this.reply(message, lines.join('\n'));
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
        [
          `┌─────────────────────────────`,
          `│ ❌ **Invalid arguments**`,
          `├─────────────────────────────`,
          `│ Usage: \`*task status <id> <status>\``,
          `│ Statuses: \`todo\` → \`in_progress\` → \`done\``,
          `│           \`todo\` or \`in_progress\` → \`cancelled\``,
          `└─────────────────────────────`,
        ].join('\n'),
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
        `❌ Task **#${taskId}** not found in current project.`,
      );
      return;
    }

    if (!this.hasTaskPermission(context.user, existingTask)) {
      await this.reply(
        message,
        `❌ You don't have permission to update task **#${taskId}**.\nOnly the assignee, PM, or Admin can change task status.`,
      );
      return;
    }

    const updatedTask = await this.taskService.updateTaskStatus(taskId, {
      authorUserId: context.user.id,
      status,
    });

    if (!updatedTask) {
      await this.reply(message, `❌ Task **#${taskId}** not found.`);
      return;
    }

    const STATUS_ICON: Record<string, string> = {
      [TaskStatus.TODO]: '⬜',
      [TaskStatus.IN_PROGRESS]: '🔵',
      [TaskStatus.DONE]: '✅',
      [TaskStatus.CANCELLED]: '🚫',
    };

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🔄 **Status Updated**`,
        `├─────────────────────────────`,
        `│ 🆔  Task   : #${updatedTask.id} ${updatedTask.title}`,
        `│ ${STATUS_ICON[updatedTask.status] ?? '❓'}  Status : **${updatedTask.status}**`,
        `│ 📁  Project: ${context.project.name}`,
        `└─────────────────────────────`,
      ].join('\n'),
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
        [
          `┌─────────────────────────────`,
          `│ ❌ **Missing required fields**`,
          `├─────────────────────────────`,
          `│ Usage: \`*task assign <id> <userId|@username>\``,
          `│ Example: \`*task assign 12 @alice\``,
          `└─────────────────────────────`,
        ].join('\n'),
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
        `❌ Task **#${taskId}** not found in current project.`,
      );
      return;
    }

    const targetIdentifier =
      this.getMentionedUserIdentifier(rawIdentifier, message) ??
      rawIdentifier.replace(/^@/, '').trim();
    const targetUser =
      await this.userService.findByIdentifier(targetIdentifier);

    if (!targetUser) {
      await this.reply(message, `❌ User **${rawIdentifier}** not found.`);
      return;
    }

    if (!this.canAssignTask(context.user, targetUser.id)) {
      await this.reply(
        message,
        `❌ You don't have permission to assign task **#${taskId}**.\nOnly PM/Admin can assign to others. You may self-assign.`,
      );
      return;
    }

    const task = await this.taskService.assignTask(taskId, targetUser.id);

    if (!task) {
      await this.reply(message, `❌ Task **#${taskId}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ✅ **Task Assigned**`,
        `├─────────────────────────────`,
        `│ 🆔  Task    : #${task.id} ${task.title}`,
        `│ 👤  Assignee: ${targetUser.name ?? targetUser.mezonId}`,
        `│ 🪪  Mezon ID: \`${targetUser.mezonId}\``,
        `│ 📁  Project : ${context.project.name}`,
        `└─────────────────────────────`,
      ].join('\n'),
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

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    if (!this.isProjectManagerOrAdmin(context.user)) {
      await this.reply(
        message,
        '❌ Only **Administrators** and **Project Managers** can delete tasks.',
      );
      return;
    }

    const existingTask = await this.findTaskInProject(
      taskId,
      context.projectId,
    );

    if (!existingTask) {
      await this.reply(
        message,
        `❌ Task **#${taskId}** not found in current project.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🗑️ **Confirm Delete Task**`,
        `├─────────────────────────────`,
        `│ 🆔  ID      : #${existingTask.id}`,
        `│ 📝  Title   : ${existingTask.title}`,
        `│ ⬜  Status  : ${existingTask.status}`,
        `│ 📁  Project : ${context.project.name}`,
        `├─────────────────────────────`,
        `│ ⚠️  This action **cannot be undone**.`,
        `│ Run to confirm:`,
        `│ \`*task confirm delete ${existingTask.id}\``,
        `└─────────────────────────────`,
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

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    if (!this.isProjectManagerOrAdmin(context.user)) {
      await this.reply(
        message,
        '❌ Only **Administrators** and **Project Managers** can delete tasks.',
      );
      return;
    }

    const existingTask = await this.findTaskInProject(
      taskId,
      context.projectId,
    );

    if (!existingTask) {
      await this.reply(
        message,
        `❌ Task **#${taskId}** not found in current project.`,
      );
      return;
    }

    const deleted = await this.taskService.deleteTask(taskId);

    if (!deleted) {
      await this.reply(message, `❌ Failed to delete task **#${taskId}**.`);
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🗑️ **Task Deleted**`,
        `├─────────────────────────────`,
        `│ 🆔  ID      : #${existingTask.id}`,
        `│ 📝  Title   : ${existingTask.title}`,
        `│ 📁  Project : ${context.project.name}`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private parseFlagNumber(
    args: string[],
    flag: string,
    fallback: number,
  ): number {
    const idx = args.indexOf(flag);
    if (idx === -1) return fallback;
    return Math.max(
      1,
      parseInt(args[idx + 1] ?? String(fallback), 10) || fallback,
    );
  }

  private parseFlagString(args: string[], flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx === -1 || !args[idx + 1]) return undefined;
    return args[idx + 1];
  }

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
