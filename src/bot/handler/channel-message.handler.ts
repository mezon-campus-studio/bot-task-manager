import { Injectable, Logger } from '@nestjs/common';
import { Events } from 'mezon-sdk';
import { AutoContext, On } from '#src/libs/nezon/index.js';

/**
 * Main channel message handler.
 *
 * - Handles raw channel messages (non-command)
 * - Provides *ping and *help commands for testing/discovery
 */
@Injectable()
export default class ChannelMessageHandler {
  private readonly logger = new Logger(ChannelMessageHandler.name);

  constructor() {}

  @On(Events.ChannelMessage)
  async onMessage(@AutoContext() [message]: any) {
    const rawMsg = message?.raw || message;
    const content = rawMsg?.content?.t || '';
    if (!content) return;

    const lowerContent = content.trim().toLowerCase();

    if (lowerContent === 'hello' || lowerContent === '!help') {
      try {
        const helpMessage = `
**🤖 Bot Task Manager Instructions**

Here are the available commands:

**1. Role Module (!role)**
- \`!role list\` - List all roles
- \`!role create <key> <name> <scopeType>\` - Create a new role (Scope: SYSTEM, PROJECT, TEAM)
- \`!role delete <id>\` - Delete a role by ID

**2. Permission Module (!permission)**
- \`!permission list\` - List all permissions
- \`!permission create <key> <resource> <action>\` - Create a new permission
- \`!permission delete <id>\` - Delete a permission by ID

**3. Role-Permission Module (!role-permission)**
- \`!role-permission list <roleId>\` - List permissions assigned to a role
- \`!role-permission assign <roleId> <permissionId>\` - Assign a permission to a role
- \`!role-permission remove <roleId> <permissionId>\` - Remove a permission from a role

**4. Note Module (!note)**
- \`!note list <projectId> <resourceType> <resourceId>\` - List notes for a specific resource
- \`!note create <projectId> <resourceType> <resourceId> <content>\` - Create a new note
        `;
        await message.reply(helpMessage);
      } catch (error) {
        this.logger.error('Error in help command:', error);
      }
    }
  }
}
