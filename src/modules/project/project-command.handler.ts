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
        case 'list':
          await this.listProjects(senderId, message, ctx);
          return;
        case 'create':
          await this.createProject(args, message, ctx);
          return;
        case 'list':
          await this.listProjects(message);
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
              '  `*project list` – List all projects you own',
              '  `*project create <slug> <name...>` – Create a new project',
              '  `*project use <projectId|projectSlug>` – Select a project to work with',
              '  `*project current` – Show current selected project',
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

    // Get user's own projects
    const ownedProjects = await this.projectService.findByOwnerUserId(
      dbUser.id,
    );

    // Get all projects
    const allProjects = await this.projectService.listProjects();

    let response = '📁 **Your Projects:**';
    if (ownedProjects.length > 0) {
      const ownedLines = ownedProjects.map(
        (p) => `  [#${p.id}] ${p.name} (${p.slug}) ⭐`,
      );
      response += '\n' + ownedLines.join('\n');
    } else {
      response += '\n  You have no projects yet.';
    }

    // Show all projects if there are any besides user's own
    const otherProjects = allProjects.filter(
      (p) => !ownedProjects.some((op) => op.id === p.id),
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

    if (
      Number(dbUser.role) !== UserRole.PM &&
      Number(dbUser.role) !== UserRole.ADMIN
    ) {
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

  private async listProjects(message: ManagedMessage): Promise<void> {
    const projects = await this.projectService.listProjects();

    if (!projects.length) {
      await this.reply(message, 'No projects found.');
      return;
    }

    const lines = projects.map(
      (project) => `  [#${project.id}] ${project.name} (\`${project.slug}\`)`,
    );

    await this.reply(message, ['📁 Projects:', ...lines].join('\n'));
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

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
