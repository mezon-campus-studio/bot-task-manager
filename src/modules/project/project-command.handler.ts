import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  AutoContext,
  Command,
  ManagedMessage,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';
import { ProjectContextService } from './project-context.service';

@Injectable()
@UseGuards(NezonAuthGuard)
export class ProjectCommandHandler {
  private readonly logger = new Logger(ProjectCommandHandler.name);

  constructor(private readonly projectContextService: ProjectContextService) {}

  @Command('project')
  async handleProjectCommand(
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
            'Usage: *project use <projectId|projectSlug>, *project current, *project exit',
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
