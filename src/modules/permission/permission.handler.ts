import { Injectable, Logger } from '@nestjs/common';
import { Events } from 'mezon-sdk';
import { AutoContext, On } from '#src/libs/nezon/index.js';
import { PermissionService } from './permission.service';

@Injectable()
export class PermissionMessageHandler {
  private readonly logger = new Logger(PermissionMessageHandler.name);

  constructor(private readonly permissionService: PermissionService) {}

  @On(Events.ChannelMessage)
  async onMessage(@AutoContext() [message]: any) {
    const rawMsg = message?.raw || message;
    const content = rawMsg?.content?.t || '';
    if (!content) return;

    const args = content.trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (commandName !== '!permission') {
      return;
    }

    try {
      const action = args.shift()?.toLowerCase();

      if (action === 'list') {
        const permissions = await this.permissionService.findAll();
        const permStr = permissions.map(p => `[ID: ${p.id}] ${p.key} - ${p.resource}:${p.action}`).join('\n') || 'No permissions found.';
        await message.reply(`**Permissions List:**\n${permStr}`);
      } 
      else if (action === 'create') {
        const [key, resource, permAction] = args;
        if (!key || !resource || !permAction) {
          await message.reply('Usage: `!permission create <key> <resource> <action>`');
          return;
        }
        
        const permission = await this.permissionService.createPermission({ key, resource, action: permAction });
        await message.reply(`✅ Created permission: ${permission.key} (ID: ${permission.id})`);
      }
      else if (action === 'delete') {
        const id = parseInt(args[0], 10);
        if (isNaN(id)) {
          await message.reply('Usage: `!permission delete <id>`');
          return;
        }
        await this.permissionService.deleteById(id);
        await message.reply(`✅ Deleted permission ID: ${id}`);
      }
      else {
        await message.reply('Unknown permission command. Usage: `!permission <list|create|delete> ...`');
      }
    } catch (error: any) {
      this.logger.error('Error executing permission command:', error);
      await message.reply(`❌ Error: ${error.message}`);
    }
  }
}
