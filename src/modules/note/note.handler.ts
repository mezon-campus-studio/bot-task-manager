import { Injectable, Logger } from '@nestjs/common';
import { Events } from 'mezon-sdk';
import { AutoContext, On } from '#src/libs/nezon/index.js';
import { NoteService } from './note.service';
import { NoteResourceType } from './enums/note-resource-type.enum';

@Injectable()
export class NoteMessageHandler {
  private readonly logger = new Logger(NoteMessageHandler.name);

  constructor(private readonly noteService: NoteService) {}

  @On(Events.ChannelMessage)
  async onMessage(@AutoContext() [message]: any) {
    const rawMsg = message?.raw || message;
    const content = rawMsg?.content?.t || '';
    if (!content) return;

    const args = content.trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (commandName !== '!note') {
      return;
    }

    try {
      const action = args.shift()?.toLowerCase();

      if (action === 'list') {
        const projectId = parseInt(args[0], 10);
        const resourceType = args[1]?.toUpperCase() as NoteResourceType;
        const resourceId = args[2];

        if (isNaN(projectId) || !resourceType || !resourceId) {
          await message.reply('Usage: `!note list <projectId> <resourceType(PROJECT|TEAM|TASK|...)> <resourceId>`');
          return;
        }

        const notes = await this.noteService.listByResource(projectId, resourceType, resourceId);
        const noteStr = notes.map(n => `[ID: ${n.id}] By: ${n.authorUserId} - ${n.content}`).join('\n') || 'No notes found.';
        await message.reply(`**Notes List:**\n${noteStr}`);
      } 
      else if (action === 'create') {
        const projectId = parseInt(args[0], 10);
        const resourceType = args[1]?.toUpperCase() as NoteResourceType;
        const resourceId = args[2];
        const noteContent = args.slice(3).join(' ');

        if (isNaN(projectId) || !resourceType || !resourceId || !noteContent) {
          await message.reply('Usage: `!note create <projectId> <resourceType> <resourceId> <content>`');
          return;
        }
        
        const note = await this.noteService.createNote({
          projectId,
          resourceType,
          resourceId,
          content: noteContent,
          authorUserId: message.senderId, // ManagedMessage has senderId
          isShared: true,
        });
        await message.reply(`✅ Created note ID: ${note.id}`);
      }
      else {
        await message.reply('Unknown command. Usage: `!note <list|create> ...`');
      }
    } catch (error: any) {
      this.logger.error('Error executing note command:', error);
      await message.reply(`❌ Error: ${error.message}`);
    }
  }
}
