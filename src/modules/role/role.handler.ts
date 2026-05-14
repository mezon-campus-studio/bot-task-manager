import { Injectable, Logger } from '@nestjs/common';
import { Events } from 'mezon-sdk';
import { AutoContext, On } from '#src/libs/nezon/index.js';
import { RoleService } from './role.service';
import { RoleScopeType } from './enums/role-scope-type.enum';

@Injectable()
export class RoleMessageHandler {
  private readonly logger = new Logger(RoleMessageHandler.name);

  constructor(private readonly roleService: RoleService) {}

  @On(Events.ChannelMessage)
  async onMessage(@AutoContext() [message]: any) {
    const rawMsg = message?.raw || message;
    const content = rawMsg?.content?.t || '';
    if (!content) return;

    const args = content.trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (commandName !== '!role') {
      return;
    }

    try {
      const action = args.shift()?.toLowerCase();

      if (action === 'list') {
        const roles = await this.roleService.findAll();
        const roleStr = roles.map(r => `[ID: ${r.id}] ${r.key} - ${r.name} (${r.scopeType})`).join('\n') || 'No roles found.';
        await message.reply(`**Roles List:**\n${roleStr}`);
      } 
      else if (action === 'create') {
        const [key, name, scopeType] = args;
        if (!key || !name || !scopeType) {
          await message.reply('Usage: `!role create <key> <name> <scopeType(SYSTEM|PROJECT|TEAM)>`');
          return;
        }
        
        const role = await this.roleService.createRole({ 
          key, 
          name, 
          scopeType: scopeType as RoleScopeType,
          isSystem: false 
        });
        await message.reply(`✅ Created role: ${role.name} (ID: ${role.id})`);
      }
      else if (action === 'delete') {
        const id = parseInt(args[0], 10);
        if (isNaN(id)) {
          await message.reply('Usage: `!role delete <id>`');
          return;
        }
        await this.roleService.deleteRole(id);
        await message.reply(`✅ Deleted role ID: ${id}`);
      }
      else {
        await message.reply('Unknown role command. Usage: `!role <list|create|delete> ...`');
      }
    } catch (error: any) {
      this.logger.error('Error executing role command:', error);
      await message.reply(`❌ Error: ${error.message}`);
    }
  }
}
