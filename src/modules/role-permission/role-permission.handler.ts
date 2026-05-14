import { Injectable, Logger } from '@nestjs/common';
import { Events } from 'mezon-sdk';
import { AutoContext, On } from '#src/libs/nezon/index.js';
import { RolePermissionService } from './role-permission.service';

@Injectable()
export class RolePermissionMessageHandler {
  private readonly logger = new Logger(RolePermissionMessageHandler.name);

  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @On(Events.ChannelMessage)
  async onMessage(@AutoContext() [message]: any) {
    const rawMsg = message?.raw || message;
    const content = rawMsg?.content?.t || '';
    if (!content) return;

    const args = content.trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (commandName !== '!role-permission') {
      return;
    }

    try {
      const action = args.shift()?.toLowerCase();

      if (action === 'list') {
        const roleId = parseInt(args[0], 10);
        if (isNaN(roleId)) {
          await message.reply('Usage: `!role-permission list <roleId>`');
          return;
        }
        const links = await this.rolePermissionService.findByRoleId(roleId);
        const linkStr = links.map(l => `- Permission ID: ${l.permissionId}`).join('\n') || 'No permissions linked to this role.';
        await message.reply(`**Role-Permission List for Role ID ${roleId}:**\n${linkStr}`);
      } 
      else if (action === 'assign') {
        const roleId = parseInt(args[0], 10);
        const permissionId = parseInt(args[1], 10);
        if (isNaN(roleId) || isNaN(permissionId)) {
          await message.reply('Usage: `!role-permission assign <roleId> <permissionId>`');
          return;
        }
        
        await this.rolePermissionService.createRolePermission({ roleId, permissionId });
        await message.reply(`✅ Assigned Permission ID ${permissionId} to Role ID ${roleId}`);
      }
      else if (action === 'remove') {
        const roleId = parseInt(args[0], 10);
        const permissionId = parseInt(args[1], 10);
        if (isNaN(roleId) || isNaN(permissionId)) {
          await message.reply('Usage: `!role-permission remove <roleId> <permissionId>`');
          return;
        }
        await this.rolePermissionService.removeRolePermission(roleId, permissionId);
        await message.reply(`✅ Removed Permission ID ${permissionId} from Role ID ${roleId}`);
      }
      else {
        await message.reply('Unknown command. Usage: `!role-permission <list|assign|remove> ...`');
      }
    } catch (error: any) {
      this.logger.error('Error executing role-permission command:', error);
      await message.reply(`❌ Error: ${error.message}`);
    }
  }
}
