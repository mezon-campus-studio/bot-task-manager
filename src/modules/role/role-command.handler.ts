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
import { RoleScopeType } from './enums/role-scope-type.enum';
import RoleEntity from './role.entity';
import { RoleService } from './role.service';

@Injectable()
@UseGuards(NezonAuthGuard)
export class RoleCommandHandler {
  private readonly logger = new Logger(RoleCommandHandler.name);

  constructor(private readonly roleService: RoleService) {}

  @Command('role')
  async handleRoleCommand(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
    @Context() ctx: NezonCommandContext,
  ): Promise<void> {
    const action = args[0]?.toLowerCase();

    try {
      switch (action) {
        case 'list':
          await this.listRoles(args, message);
          return;
        case 'detail':
          await this.detailRole(args, message);
          return;
        case 'create':
          await this.createRole(args, message, ctx);
          return;
        case 'update':
          await this.updateRole(args, message, ctx);
          return;
        case 'delete':
          await this.deleteRole(args, message, ctx);
          return;
        case 'confirm':
          if (args[1]?.toLowerCase() === 'delete') {
            await this.confirmDeleteRole(args, message, ctx);
            return;
          }
          await this.reply(message, 'Usage: `*role confirm delete <id>`');
          return;
        default:
          await this.reply(
            message,
            [
              'Role Commands:',
              '  `*role list [SYSTEM|PROJECT|TEAM]` - List roles',
              '  `*role detail <id|key>` - View role detail',
              '  `*role create <key> <SYSTEM|PROJECT|TEAM> <name...>` - Create role (PM only)',
              '  `*role update <id> <key|name|scope|description> <value...>` - Update role (PM only)',
              '  `*role delete <id>` - Prepare delete confirmation (PM only)',
              '  `*role confirm delete <id>` - Confirm role deletion (PM only)',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Role command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listRoles(
    args: string[],
    message: ManagedMessage,
  ): Promise<void> {
    const scopeType = args[1] ? this.parseScopeType(args[1]) : null;

    if (args[1] && !scopeType) {
      await this.reply(
        message,
        'Invalid scope. Valid values: SYSTEM, PROJECT, TEAM',
      );
      return;
    }

    const roles = scopeType
      ? await this.roleService.findByScopeType(scopeType)
      : await this.roleService.findAll();

    if (!roles.length) {
      await this.reply(message, 'No roles found.');
      return;
    }

    const lines = roles.map((role) => this.formatRoleSummary(role));
    await this.reply(message, ['Roles:', ...lines].join('\n'));
  }

  private async detailRole(
    args: string[],
    message: ManagedMessage,
  ): Promise<void> {
    const role = await this.findRole(args[1]);

    if (!args[1]) {
      await this.reply(message, 'Usage: `*role detail <id|key>`');
      return;
    }

    if (!role) {
      await this.reply(message, `Role **${args[1]}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `Role #${role.id}`,
        `  Key: ${role.key}`,
        `  Name: ${role.name}`,
        `  Scope: ${role.scopeType}`,
        `  System: ${role.isSystem ? 'yes' : 'no'}`,
        `  Description: ${role.description ?? 'none'}`,
      ].join('\n'),
    );
  }

  private async createRole(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(message, 'Only project managers can create roles.');
      return;
    }

    const key = args[1];
    const scopeType = this.parseScopeType(args[2]);
    const name = args.slice(3).join(' ').trim();

    if (!key || !scopeType || !name) {
      await this.reply(
        message,
        'Usage: `*role create <key> <SYSTEM|PROJECT|TEAM> <name...>`',
      );
      return;
    }

    const role = await this.roleService.createRole({
      key,
      name,
      scopeType,
    });

    await this.reply(
      message,
      `Created role **#${role.id}: ${role.name}** (${role.key}).`,
    );
  }

  private async updateRole(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(message, 'Only project managers can update roles.');
      return;
    }

    const roleId = this.parseId(args[1]);
    const field = args[2]?.toLowerCase();
    const value = args.slice(3).join(' ').trim();

    if (roleId == null || !field || !value) {
      await this.reply(
        message,
        'Usage: `*role update <id> <key|name|scope|description> <value...>`',
      );
      return;
    }

    const updates: {
      key?: string;
      name?: string;
      scopeType?: RoleScopeType;
      description?: string;
    } = {};

    switch (field) {
      case 'key':
        updates.key = value;
        break;
      case 'name':
        updates.name = value;
        break;
      case 'scope': {
        const scopeType = this.parseScopeType(value);
        if (!scopeType) {
          await this.reply(
            message,
            'Invalid scope. Valid values: SYSTEM, PROJECT, TEAM',
          );
          return;
        }
        updates.scopeType = scopeType;
        break;
      }
      case 'description':
        updates.description = value;
        break;
      default:
        await this.reply(
          message,
          'Invalid field. Valid fields: key, name, scope, description',
        );
        return;
    }

    const role = await this.roleService.updateRole(roleId, updates);
    await this.reply(message, `Updated role **#${role.id}: ${role.name}**.`);
  }

  private async deleteRole(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(message, 'Only project managers can delete roles.');
      return;
    }

    const roleId = this.parseId(args[1]);

    if (roleId == null) {
      await this.reply(message, 'Usage: `*role delete <id>`');
      return;
    }

    const role = await this.roleService.findById(roleId);
    if (!role) {
      await this.reply(message, `Role **${args[1]}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `🗑️ Are you sure you want to delete role **#${role.id}: ${role.name}**?`,
        `Run: \`*role confirm delete ${role.id}\` to complete the deletion.`,
      ].join('\n'),
    );
  }

  private async confirmDeleteRole(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isProjectManager(ctx)) {
      await this.reply(message, 'Only project managers can delete roles.');
      return;
    }

    const roleId = this.parseId(args[2]);

    if (roleId == null) {
      await this.reply(message, 'Usage: `*role confirm delete <id>`');
      return;
    }

    await this.roleService.deleteRole(roleId);
    await this.reply(message, `Deleted role **#${roleId}**.`);
  }

  private async findRole(identifier: string | undefined) {
    if (!identifier) return null;
    const roleId = this.parseId(identifier);
    return roleId == null
      ? this.roleService.findByKey(identifier)
      : this.roleService.findById(roleId);
  }

  private parseScopeType(value: string | undefined): RoleScopeType | null {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    const values = Object.values(RoleScopeType) as string[];
    return values.includes(normalized) ? (normalized as RoleScopeType) : null;
  }

  private parseId(value: string | undefined): number | null {
    if (!value) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private formatRoleSummary(role: RoleEntity): string {
    return `  [#${role.id}] ${role.name} (${role.key}) - ${role.scopeType}${role.isSystem ? ' - system' : ''}`;
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

    return error instanceof Error ? error.message : 'Role command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
