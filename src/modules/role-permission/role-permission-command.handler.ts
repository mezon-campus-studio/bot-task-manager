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
import { PermissionService } from '@src/modules/permission/permission.service';
import { RoleService } from '@src/modules/role/role.service';
import { RolePermissionService } from './role-permission.service';

@Injectable()
@UseGuards(NezonAuthGuard)
export class RolePermissionCommandHandler {
  private readonly logger = new Logger(RolePermissionCommandHandler.name);

  constructor(
    private readonly rolePermissionService: RolePermissionService,
    private readonly roleService: RoleService,
    private readonly permissionService: PermissionService,
  ) {}

  @Command('role-permission')
  async handleRolePermissionCommand(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
    @Context() ctx: NezonCommandContext,
  ): Promise<void> {
    const action = args[0]?.toLowerCase();

    try {
      switch (action) {
        case 'assign':
          await this.assignRolePermission(args, message, ctx);
          return;
        case 'remove':
          await this.removeRolePermission(args, message, ctx);
          return;
        case 'list-role':
          await this.listByRole(args, message);
          return;
        case 'list-permission':
          await this.listByPermission(args, message);
          return;
        default:
          await this.reply(
            message,
            [
              'Role-Permission Commands:',
              '  `*role-permission assign <roleId> <permissionId>` - Assign permission to role (PM only)',
              '  `*role-permission remove <roleId> <permissionId>` - Remove permission from role (PM only)',
              '  `*role-permission list-role <roleId>` - List permissions assigned to role',
              '  `*role-permission list-permission <permissionId>` - List roles assigned to permission',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn(
        'Role-permission command failed',
        (error as Error)?.stack,
      );
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async assignRolePermission(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(
        message,
        'Only project managers can assign role permissions.',
      );
      return;
    }

    const parsed = await this.parseRolePermissionArgs(args, message, 'assign');
    if (!parsed) return;

    if (!(await this.ensureRoleAndPermission(parsed, message))) {
      return;
    }

    const rolePermission =
      await this.rolePermissionService.createRolePermission(parsed);

    await this.reply(
      message,
      `Assigned permission **#${rolePermission.permissionId}** to role **#${rolePermission.roleId}**.`,
    );
  }

  private async removeRolePermission(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(
        message,
        'Only project managers can remove role permissions.',
      );
      return;
    }

    const parsed = await this.parseRolePermissionArgs(args, message, 'remove');
    if (!parsed) return;

    if (!(await this.ensureRoleAndPermission(parsed, message))) {
      return;
    }

    const roleLinks = await this.rolePermissionService.findByRoleId(
      parsed.roleId,
    );
    const exists = roleLinks.some(
      (link) => link.permissionId === parsed.permissionId,
    );

    if (!exists) {
      await this.reply(
        message,
        `Permission #${parsed.permissionId} is not assigned to role #${parsed.roleId}.`,
      );
      return;
    }

    await this.rolePermissionService.removeRolePermission(
      parsed.roleId,
      parsed.permissionId,
    );

    await this.reply(
      message,
      `Removed permission **#${parsed.permissionId}** from role **#${parsed.roleId}**.`,
    );
  }

  private async listByRole(
    args: string[],
    message: ManagedMessage,
  ): Promise<void> {
    const roleId = this.parseId(args[1]);

    if (roleId == null) {
      await this.reply(message, 'Usage: `*role-permission list-role <roleId>`');
      return;
    }

    const role = await this.roleService.findById(roleId);
    if (!role) {
      await this.reply(message, `Role #${roleId} not found.`);
      return;
    }

    const links = await this.rolePermissionService.findByRoleId(roleId);

    if (!links.length) {
      await this.reply(message, `No permissions assigned to role #${roleId}.`);
      return;
    }

    const lines = links.map((link) => `  permissionId: ${link.permissionId}`);
    await this.reply(
      message,
      [`Permissions for role #${roleId}:`, ...lines].join('\n'),
    );
  }

  private async listByPermission(
    args: string[],
    message: ManagedMessage,
  ): Promise<void> {
    const permissionId = this.parseId(args[1]);

    if (permissionId == null) {
      await this.reply(
        message,
        'Usage: `*role-permission list-permission <permissionId>`',
      );
      return;
    }

    const permission = await this.permissionService.findById(permissionId);
    if (!permission) {
      await this.reply(message, `Permission #${permissionId} not found.`);
      return;
    }

    const links =
      await this.rolePermissionService.findByPermissionId(permissionId);

    if (!links.length) {
      await this.reply(
        message,
        `No roles assigned to permission #${permissionId}.`,
      );
      return;
    }

    const lines = links.map((link) => `  roleId: ${link.roleId}`);
    await this.reply(
      message,
      [`Roles for permission #${permissionId}:`, ...lines].join('\n'),
    );
  }

  private async parseRolePermissionArgs(
    args: string[],
    message: ManagedMessage,
    action: 'assign' | 'remove',
  ): Promise<{ roleId: number; permissionId: number } | null> {
    const roleId = this.parseId(args[1]);
    const permissionId = this.parseId(args[2]);

    if (roleId == null || permissionId == null) {
      await this.reply(
        message,
        `Usage: \`*role-permission ${action} <roleId> <permissionId>\``,
      );
      return null;
    }

    return { permissionId, roleId };
  }

  private async ensureRoleAndPermission(
    input: { roleId: number; permissionId: number },
    message: ManagedMessage,
  ): Promise<boolean> {
    const [role, permission] = await Promise.all([
      this.roleService.findById(input.roleId),
      this.permissionService.findById(input.permissionId),
    ]);

    if (!role) {
      await this.reply(message, `Role #${input.roleId} not found.`);
      return false;
    }

    if (!permission) {
      await this.reply(message, `Permission #${input.permissionId} not found.`);
      return false;
    }

    return true;
  }

  private parseId(value: string | undefined): number | null {
    if (!value) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
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
      : 'Role-permission command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
