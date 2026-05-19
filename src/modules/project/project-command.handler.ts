import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import {
  buildPaginationFooter,
  paginate,
} from '@src/common/utils/pagination.util';
import {
  Args,
  AutoContext,
  Command,
  Context,
  ManagedMessage,
  NezonCommandContext,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';
import { ProjectContextService } from './project-context.service';
import { ProjectService } from './project.service';

@Injectable()
@UseGuards(NezonAuthGuard)
export class ProjectCommandHandler {
  private readonly logger = new Logger(ProjectCommandHandler.name);

  constructor(
    private readonly projectContextService: ProjectContextService,
    private readonly projectService: ProjectService,
  ) {}

  @Command('project')
  async handleProjectCommand(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
    @Context() ctx: NezonCommandContext,
  ): Promise<void> {
    const action = args[0]?.toLowerCase();
    const senderId = message.senderId;

    if (!senderId) {
      await this.reply(message, 'Cannot resolve command sender.');
      return;
    }

    try {
      switch (action) {
        case 'create':
          await this.createProject(args, message, ctx);
          return;
        case 'list':
          await this.listProjects(senderId, message, ctx, args);
          return;
        case 'delete':
          await this.prepareDeleteProject(args, message, ctx);
          return;
        case 'confirm':
          if (args[1]?.toLowerCase() === 'delete') {
            await this.confirmDeleteProject(args, message, ctx);
            return;
          }
          await this.reply(
            message,
            'Usage: `*project confirm delete <projectId|projectSlug>`',
          );
          return;
        case 'use':
          await this.useProject(args, senderId, message);
          return;
        case 'current':
          await this.getCurrentProject(senderId, message);
          return;
        case 'exit':
          await this.exitProject(senderId, message);
          return;
        default:
          await this.reply(
            message,
            [
              `┌─────────────────────────────`,
              `│ 📁 **Project Commands**`,
              `├─────────────────────────────`,
              `│ \`*project list [--page N]\`                              – List all accessible projects`,
              `│ \`*project create <slug> <name...>\`                  – Create a new project`,
              `│ \`*project use <projectId|slug>\`                     – Select a project to work with`,
              `│ \`*project current\`                                  – Show current selected project`,
              `│ \`*project exit\`                                     – Exit current project`,
              `│ \`*project delete <projectId|slug>\`                  – Prepare delete confirmation`,
              `│ \`*project confirm delete <projectId|slug>\`          – Confirm project deletion`,
              `└─────────────────────────────`,
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn(
        'Project command failed',
        (error as Error | undefined)?.stack,
      );

      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listProjects(
    _senderId: string,
    message: ManagedMessage,
    ctx: NezonCommandContext,
    args: string[] = [],
  ): Promise<void> {
    const dbUser = (ctx as any).dbUser;
    if (!dbUser) {
      await this.reply(message, '❌ User not found in database.');
      return;
    }

    let page = 1;
    const pageFlagIndex = args.findIndex(
      (arg) => arg.toLowerCase() === '--page',
    );

    if (pageFlagIndex !== -1 && args[pageFlagIndex + 1]) {
      page = Math.max(1, parseInt(args[pageFlagIndex + 1], 10) || 1);
    } else {
      page = Math.max(1, parseInt(args[1] ?? '1', 10) || 1);
    }
    const [accessibleProjects, ownedProjects, allProjects] = await Promise.all([
      this.projectService.listAccessibleProjectsForUser(dbUser.id),
      this.projectService.findByOwnerUserId(dbUser.id),
      this.projectService.listProjects(),
    ]);

    const ownedProjectIds = new Set(ownedProjects.map(({ id }) => id));
    const otherProjects = allProjects.filter(
      (p) => !accessibleProjects.some((ap) => ap.id === p.id),
    );

    type ProjectRow = {
      project: (typeof accessibleProjects)[0];
      section: 'yours' | 'other';
    };

    const allRows: ProjectRow[] = [
      ...accessibleProjects.map((p) => ({
        project: p,
        section: 'yours' as const,
      })),
      ...otherProjects.map((p) => ({ project: p, section: 'other' as const })),
    ];

    if (allRows.length === 0) {
      await this.reply(message, 'ℹ️ No projects found.');
      return;
    }

    const { items: pageRows, meta } = paginate(allRows, page);

    const lines: string[] = [
      `┌─────────────────────────────`,
      `│ 📁 **Project List**`,
      `├─────────────────────────────`,
    ];

    const yoursOnPage = pageRows.filter((r) => r.section === 'yours');
    const otherOnPage = pageRows.filter((r) => r.section === 'other');

    if (yoursOnPage.length > 0) {
      lines.push(`│ 🔓 **Your Projects**`);
      for (const { project: p } of yoursOnPage) {
        const ownerTag = ownedProjectIds.has(p.id) ? ' ⭐' : '';
        lines.push(`│   [#${p.id}]${ownerTag} **${p.name}**`);
        lines.push(`│        Slug : \`${p.slug}\``);
        if (p.description) lines.push(`│        Desc : ${p.description}`);
      }
    }

    if (otherOnPage.length > 0) {
      if (yoursOnPage.length > 0) lines.push(`│`);
      lines.push(`│ 🌐 **Other Projects**`);
      for (const { project: p } of otherOnPage) {
        lines.push(`│   [#${p.id}] **${p.name}**`);
        lines.push(`│        Slug : \`${p.slug}\``);
      }
    }

    lines.push(`├─────────────────────────────`);
    lines.push(`│ ${buildPaginationFooter(meta, '*project list')}`);
    lines.push(`│ 💡 \`*project use <slug|id>\` to select`);
    lines.push(`└─────────────────────────────`);

    await this.reply(message, lines.join('\n'));
  }

  private async createProject(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const dbUser = (ctx as any).dbUser;
    if (!dbUser) {
      await this.reply(
        message,
        '❌ User not found in database. Please log in once via portal.',
      );
      return;
    }

    if (!this.isProjectManagerOrAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only **Project Managers** and **Administrators** can create projects.',
      );
      return;
    }

    const slug = args[1];
    const rawNameParts = args.slice(2);
    if (!slug || rawNameParts.length === 0) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ❌ **Missing required fields**`,
          `├─────────────────────────────`,
          `│ Usage: \`*project create <slug> <name...>\``,
          `│ Example: \`*project create my-app My Application\``,
          `└─────────────────────────────`,
        ].join('\n'),
      );
      return;
    }

    const name = rawNameParts.join(' ').trim();
    if (!name) {
      await this.reply(message, '❌ Project name is required.');
      return;
    }

    const project = await this.projectService.createProject({
      name,
      slug,
      ownerUserId: dbUser.id,
    });

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ✅ **Project Created**`,
        `├─────────────────────────────`,
        `│ 📛  Name  : ${project.name}`,
        `│ 🔖  Slug  : \`${project.slug}\``,
        `│ 🆔  ID    : #${project.id}`,
        `│ 👤  Owner : ${dbUser.name ?? dbUser.mezonId}`,
        `├─────────────────────────────`,
        `│ 💡 Use \`*project use ${project.slug}\` to select it`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async prepareDeleteProject(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const dbUser = (ctx as any).dbUser;

    if (!this.isAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only **Administrators** can delete projects.',
      );
      return;
    }

    const projectKey = args[1];
    if (!projectKey) {
      await this.reply(
        message,
        'Usage: `*project delete <projectId|projectSlug>`',
      );
      return;
    }

    const project = await this.findProjectByIdentifier(projectKey);
    if (!project) {
      await this.reply(message, `❌ Project **${projectKey}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🗑️ **Confirm Delete Project**`,
        `├─────────────────────────────`,
        `│ 📛  Name : ${project.name}`,
        `│ 🔖  Slug : \`${project.slug}\``,
        `│ 🆔  ID   : #${project.id}`,
        `├─────────────────────────────`,
        `│ ⚠️  This action **cannot be undone**.`,
        `│ Run to confirm:`,
        `│ \`*project confirm delete ${project.id}\``,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async confirmDeleteProject(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const dbUser = (ctx as any).dbUser;

    if (!this.isAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only **Administrators** can delete projects.',
      );
      return;
    }

    const projectKey = args[2];
    if (!projectKey) {
      await this.reply(
        message,
        'Usage: `*project confirm delete <projectId|projectSlug>`',
      );
      return;
    }

    const project = await this.findProjectByIdentifier(projectKey);
    if (!project) {
      await this.reply(message, `❌ Project **${projectKey}** not found.`);
      return;
    }

    const deleted = await this.projectService.deleteProject(project.id);
    if (!deleted) {
      await this.reply(
        message,
        `❌ Failed to delete project **${projectKey}**. It may have already been removed.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🗑️ **Project Deleted**`,
        `├─────────────────────────────`,
        `│ 📛  Name : ${project.name}`,
        `│ 🔖  Slug : \`${project.slug}\``,
        `│ 🆔  ID   : #${project.id}`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async useProject(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const projectKey = args[1];

    if (!projectKey) {
      await this.reply(
        message,
        'Usage: `*project use <projectId|projectSlug>`',
      );
      return;
    }

    const context = await this.projectContextService.useProjectByMezonId(
      senderId,
      projectKey,
    );

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ✅ **Project Selected**`,
        `├─────────────────────────────`,
        `│ 📛  Name : ${context.project.name}`,
        `│ 🔖  Slug : \`${context.project.slug}\``,
        `│ 🆔  ID   : #${context.project.id}`,
        `├─────────────────────────────`,
        `│ 💡 Use \`*project exit\` to deselect`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async getCurrentProject(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getCurrentProjectByMezonId(senderId);

    if (context.project == null) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ 📁 **Current Project**`,
          `├─────────────────────────────`,
          `│ ℹ️  No project selected.`,
          `│ Use \`*project use <slug|id>\` to select one.`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 📁 **Current Project**`,
        `├─────────────────────────────`,
        `│ 📛  Name : ${context.project.name}`,
        `│ 🔖  Slug : \`${context.project.slug}\``,
        `│ 🆔  ID   : #${context.project.id}`,
        `├─────────────────────────────`,
        `│ 💡 Use \`*project exit\` to deselect`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async exitProject(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    await this.projectContextService.exitProjectByMezonId(senderId);
    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 👋 **Exited Project**`,
        `├─────────────────────────────`,
        `│ You have exited the current project.`,
        `│ Use \`*project use <slug|id>\` to select a new one.`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
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

    return 'Project command failed.';
  }

  private async findProjectByIdentifier(projectKey: string) {
    const normalizedProjectKey = projectKey.trim();

    if (!normalizedProjectKey) {
      return null;
    }

    if (/^\d+$/.test(normalizedProjectKey)) {
      return this.projectService.findById(Number(normalizedProjectKey));
    }

    return this.projectService.findBySlug(normalizedProjectKey);
  }

  private isAdmin(dbUser: any): boolean {
    const role = Number(dbUser?.role);
    return role === UserRole.ADMIN;
  }

  private isProjectManagerOrAdmin(dbUser: any): boolean {
    const role = Number(dbUser?.role);
    return role === UserRole.PM || role === UserRole.ADMIN;
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
