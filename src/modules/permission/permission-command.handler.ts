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
import PermissionEntity from './permission.entity';
import { PermissionService } from './permission.service';

@Injectable()
@UseGuards(NezonAuthGuard)
export class PermissionCommandHandler {
  private readonly logger = new Logger(PermissionCommandHandler.name);

  constructor(private readonly permissionService: PermissionService) {}

  @Command('permission')
  async handlePermissionCommand(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
    @Context() ctx: NezonCommandContext,
  ): Promise<void> {
    const action = args[0]?.toLowerCase();

    try {
      switch (action) {
        case 'list':
          await this.listPermissions(message);
          return;
        case 'detail':
          await this.detailPermission(args, message);
          return;
        case 'create':
          await this.createPermission(args, message, ctx);
          return;
        case 'update':
          await this.updatePermission(args, message, ctx);
          return;
        case 'delete':
          await this.deletePermission(args, message, ctx);
          return;
        default:
          await this.reply(
            message,
            [
              'Permission Commands:',
              '  `*permission list` - List permissions',
              '  `*permission detail <id|key>` - View permission detail',
              '  `*permission create <key> <resource> <action> [description...]` - Create permission (PM only)',
              '  `*permission update <id> <key|resource|action|description> <value...>` - Update permission (PM only)',
              '  `*permission delete <id>` - Delete permission (PM only)',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Permission command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listPermissions(message: ManagedMessage): Promise<void> {
    const permissions = await this.permissionService.findAll();

    if (!permissions.length) {
      await this.reply(message, 'No permissions found.');
      return;
    }

    const lines = permissions.map((permission) =>
      this.formatPermissionSummary(permission),
    );
    await this.reply(message, ['Permissions:', ...lines].join('\n'));
  }

  private async detailPermission(
    args: string[],
    message: ManagedMessage,
  ): Promise<void> {
    const identifier = args[1];

    if (!identifier) {
      await this.reply(message, 'Usage: `*permission detail <id|key>`');
      return;
    }

    const permission = await this.findPermission(identifier);

    if (!permission) {
      await this.reply(message, `Permission **${identifier}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `Permission #${permission.id}`,
        `  Key: ${permission.key}`,
        `  Resource: ${permission.resource}`,
        `  Action: ${permission.action}`,
        `  Description: ${permission.description ?? 'none'}`,
      ].join('\n'),
    );
  }

  private async createPermission(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(
        message,
        'Only project managers can create permissions.',
      );
      return;
    }

    const key = args[1];
    const resource = args[2];
    const action = args[3];
    const description = args.slice(4).join(' ').trim() || undefined;

    if (!key || !resource || !action) {
      await this.reply(
        message,
        'Usage: `*permission create <key> <resource> <action> [description...]`',
      );
      return;
    }

    const permission = await this.permissionService.createPermission({
      action,
      description,
      key,
      resource,
    });

    await this.reply(
      message,
      `Created permission **#${permission.id}: ${permission.key}**.`,
    );
  }

  private async updatePermission(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(
        message,
        'Only project managers can update permissions.',
      );
      return;
    }

    const permissionId = this.parseId(args[1]);
    const field = args[2]?.toLowerCase();
    const value = args.slice(3).join(' ').trim();

    if (permissionId == null || !field || !value) {
      await this.reply(
        message,
        'Usage: `*permission update <id> <key|resource|action|description> <value...>`',
      );
      return;
    }

    const updates: {
      key?: string;
      resource?: string;
      action?: string;
      description?: string;
    } = {};

    switch (field) {
      case 'key':
        updates.key = value;
        break;
      case 'resource':
        updates.resource = value;
        break;
      case 'action':
        updates.action = value;
        break;
      case 'description':
        updates.description = value;
        break;
      default:
        await this.reply(
          message,
          'Invalid field. Valid fields: key, resource, action, description',
        );
        return;
    }

    const permission = await this.permissionService.updatePermission(
      permissionId,
      updates,
    );

    await this.reply(
      message,
      `Updated permission **#${permission.id}: ${permission.key}**.`,
    );
  }

  private async deletePermission(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(
        message,
        'Only project managers can delete permissions.',
      );
      return;
    }

    const permissionId = this.parseId(args[1]);

    if (permissionId == null) {
      await this.reply(message, 'Usage: `*permission delete <id>`');
      return;
    }

    await this.permissionService.deleteById(permissionId);
    await this.reply(message, `Deleted permission **#${permissionId}**.`);
  }

  private async findPermission(identifier: string) {
    const permissionId = this.parseId(identifier);
    return permissionId == null
      ? this.permissionService.findByKey(identifier)
      : this.permissionService.findById(permissionId);
  }

  private parseId(value: string | undefined): number | null {
    if (!value) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private formatPermissionSummary(permission: PermissionEntity): string {
    return `  [#${permission.id}] ${permission.key} - ${permission.resource}:${permission.action}`;
  }

  private isProjectManager(ctx: NezonCommandContext): boolean {
    const dbUser = (ctx as any).dbUser;
    return dbUser?.role === UserRole.PM;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (
        response != null &&
        typeof response === 'object' &&
        'message' in response
      ) {
        const msg = response.message;
        if (Array.isArray(msg)) return msg.join(', ');
        if (typeof msg === 'string') return msg;
      }
    }

    return error instanceof Error
      ? error.message
      : 'Permission command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
