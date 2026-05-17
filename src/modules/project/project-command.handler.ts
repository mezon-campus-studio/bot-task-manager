import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
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
          await this.listProjects(senderId, message, ctx);
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
              '📁 **Project Commands:**',
              '  `*project list` – List all projects you can access',
              '  `*project create <slug> <name...>` – Create a new project',
              '  `*project use <projectId|projectSlug>` – Select a project to work with',
              '  `*project current` – Show current selected project',
              '  `*project delete <projectId|projectSlug>` – Prepare delete confirmation',
              '  `*project confirm delete <projectId|projectSlug>` – Confirm project deletion',
              '  `*project exit` – Exit current project',
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
  ): Promise<void> {
    const dbUser = (ctx as any).dbUser;
    if (!dbUser) {
      await this.reply(message, 'User not found in database.');
      return;
    }

    const accessibleProjects =
      await this.projectService.listAccessibleProjectsForUser(dbUser.id);

    const ownedProjects = await this.projectService.findByOwnerUserId(
      dbUser.id,
    );
    const ownedProjectIds = new Set(ownedProjects.map(({ id }) => id));

    // Get all projects
    const allProjects = await this.projectService.listProjects();

    let response = '📁 **Your Projects:**';
    if (accessibleProjects.length > 0) {
      const accessibleLines = accessibleProjects.map(
        (p) =>
          `  [#${p.id}] ${p.name} (${p.slug})${ownedProjectIds.has(p.id) ? ' ⭐' : ''}`,
      );
      response += '\n' + accessibleLines.join('\n');
    } else {
      response += '\n  You have no projects yet.';
    }

    // Show all projects if there are any besides user's accessible projects
    const otherProjects = allProjects.filter(
      (p) => !accessibleProjects.some((ap) => ap.id === p.id),
    );
    if (otherProjects.length > 0) {
      response += '\n\n📁 **All Projects:**';
      const allLines = otherProjects.map(
        (p) => `  [#${p.id}] ${p.name} (${p.slug})`,
      );
      response += '\n' + allLines.join('\n');
    }

    await this.reply(message, response);
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
        'User not found in database. Please log in once via portal.',
      );
      return;
    }

    if (!this.isProjectManagerOrAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only project managers and administrators can create projects.',
      );
      return;
    }

    const slug = args[1];
    const rawNameParts = args.slice(2);
    if (!slug || rawNameParts.length === 0) {
      await this.reply(
        message,
        'Project slug and name are required.\nUsage: `*project create <slug> <name...>`',
      );
      return;
    }

    const name = rawNameParts.join(' ').trim();
    if (!name) {
      await this.reply(
        message,
        'Project name is required.\nUsage: `*project create <slug> <name...>`',
      );
      return;
    }

    const project = await this.projectService.createProject({
      name,
      slug,
      ownerUserId: dbUser.id,
    });

    await this.reply(
      message,
      `✅ Created project **${project.name}** (\`${project.slug}\`). Use \`*project use ${project.slug}\` to select it.`,
    );
  }

  private async prepareDeleteProject(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const dbUser = (ctx as any).dbUser;

    if (!this.isAdmin(dbUser)) {
      await this.reply(message, '❌ Only administrators can delete projects.');
      return;
    }

    const projectKey = args[1];
    if (!projectKey) {
      await this.reply(
        message,
        'Project key is required.\nUsage: `*project delete <projectId|projectSlug>`',
      );
      return;
    }

    const project = await this.findProjectByIdentifier(projectKey);
    if (!project) {
      await this.reply(message, `Project **${projectKey}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `🗑️ Are you sure you want to delete project **${project.name}** (\`${project.slug}\`)?`,
        `Run: \`*project confirm delete ${project.id}\` to complete the deletion.`,
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
      await this.reply(message, '❌ Only administrators can delete projects.');
      return;
    }

    const projectKey = args[2];
    if (!projectKey) {
      await this.reply(
        message,
        'Project key is required.\nUsage: `*project confirm delete <projectId|projectSlug>`',
      );
      return;
    }

    const project = await this.findProjectByIdentifier(projectKey);
    if (!project) {
      await this.reply(message, `Project **${projectKey}** not found.`);
      return;
    }

    const deleted = await this.projectService.deleteProject(project.id);
    if (!deleted) {
      await this.reply(message, `Project **${projectKey}** not found.`);
      return;
    }

    await this.reply(
      message,
      `🗑️ Project **${project.name}** (\`${project.slug}\`) was deleted.`,
    );
  }

  private async useProject(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const projectKey = args[1];

    if (!projectKey) {
      await this.reply(message, 'Project key is required.');
      return;
    }

    const context = await this.projectContextService.useProjectByMezonId(
      senderId,
      projectKey,
    );

    await this.reply(
      message,
      `Using project ${context.project.name} (${context.project.slug}).`,
    );
  }

  private async getCurrentProject(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getCurrentProjectByMezonId(senderId);

    if (context.project == null) {
      await this.reply(message, 'No current project selected.');
      return;
    }

    await this.reply(
      message,
      `Current project is ${context.project.name} (${context.project.slug}).`,
    );
  }

  private async exitProject(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    await this.projectContextService.exitProjectByMezonId(senderId);
    await this.reply(message, 'Exited current project.');
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
