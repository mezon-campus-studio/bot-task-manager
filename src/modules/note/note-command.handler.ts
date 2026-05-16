import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  AutoContext,
  Command,
  ManagedMessage,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';
import { ProjectContextService } from '@src/modules/project/project-context.service';
import { NoteResourceType } from './enums';
import NoteEntity from './note.entity';
import { NoteService } from './note.service';

@Injectable()
@UseGuards(NezonAuthGuard)
export class NoteCommandHandler {
  private readonly logger = new Logger(NoteCommandHandler.name);

  constructor(
    private readonly noteService: NoteService,
    private readonly projectContextService: ProjectContextService,
  ) {}

  @Command('note')
  async handleNoteCommand(
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
        case 'list':
          await this.listNotes(args, senderId, message);
          return;
        case 'create':
          await this.createNote(args, senderId, message);
          return;
        case 'detail':
          await this.detailNote(args, senderId, message);
          return;
        case 'update':
          await this.updateNote(args, senderId, message);
          return;
        case 'delete':
          await this.deleteNote(args, senderId, message);
          return;
        case 'confirm':
          if (args[1]?.toLowerCase() === 'delete') {
            await this.confirmDeleteNote(args, senderId, message);
            return;
          }
          await this.reply(message, 'Usage: `*note confirm delete <id>`');
          return;
        case 'pin':
          await this.setNotePinned(args, senderId, message, true);
          return;
        case 'unpin':
          await this.setNotePinned(args, senderId, message, false);
          return;
        case 'share':
          await this.setNoteShared(args, senderId, message, true);
          return;
        case 'unshare':
          await this.setNoteShared(args, senderId, message, false);
          return;
        default:
          await this.reply(
            message,
            [
              'Note Commands:',
              '  `*note list <resourceType> <resourceId>` - List notes',
              '  `*note create <resourceType> <resourceId> <content...>` - Create a note',
              '  `*note detail <id>` - View note detail',
              '  `*note update <id> <content...>` - Update your note',
              '  `*note delete <id>` - Prepare delete confirmation',
              '  `*note confirm delete <id>` - Confirm note deletion',
              '  `*note pin <id>` / `*note unpin <id>` - Pin or unpin your note',
              '  `*note share <id>` / `*note unshare <id>` - Share or unshare your note',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Note command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listNotes(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const resourceType = this.parseResourceType(args[1]);
    const resourceId = args[2];

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const isFiltered = !!resourceType && !!resourceId;

    const notes = isFiltered
      ? await this.noteService.listByResource(
          context.projectId,
          resourceType as NoteResourceType,
          resourceId as string,
        )
      : await this.noteService.listByProject(context.projectId);

    if (!notes.length) {
      if (isFiltered) {
        await this.reply(
          message,
          `No notes found for ${resourceType} **${resourceId}** in project **${context.project.name}**.`,
        );
        return;
      }

      await this.reply(
        message,
        `No notes found in project **${context.project.name}**.`,
      );
      return;
    }

    const lines = notes.map((note) => {
      if (!isFiltered) {
        return `  [#${note.id}] ${this.formatNoteFlags(note)} ${note.resourceType} **${note.resourceId}**`;
      }
      return `  [#${note.id}] ${this.formatNoteFlags(note)} ${note.resourceType} **${note.resourceId}** ${this.truncate(note.content, 80)}`;
    });

    await this.reply(
      message,
      isFiltered
        ? [
            `Notes for ${resourceType} **${resourceId}** in **${context.project.name}**:`,
            ...lines,
          ].join('\n')
        : [`All notes in project **${context.project.name}**:`, ...lines].join(
            '\n',
          ),
    );
  }

  private async createNote(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const resourceType = this.parseResourceType(args[1]);
    const resourceId = args[2];
    const content = args.slice(3).join(' ').trim();

    if (!resourceType || !resourceId || !content) {
      await this.reply(
        message,
        'Usage: `*note create <USER|PROJECT|TEAM|TASK|TICKET|EVENT> <resourceId> <content...>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const note = await this.noteService.createNote({
      authorUserId: context.user.id,
      content,
      projectId: context.projectId,
      resourceId,
      resourceType,
      isShared: true,
    });

    await this.reply(
      message,
      `Created note **#${note.id}** for ${resourceType} **${resourceId}** in project **${context.project.name}**.`,
    );
  }

  private async detailNote(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const note = await this.getRequiredProjectNote(
      args[1],
      senderId,
      message,
      false,
    );
    if (!note) return;

    await this.reply(
      message,
      [
        `Note #${note.id}`,
        `  Resource: ${note.resourceType} ${note.resourceId}`,
        `  Author: ${note.authorUserId}`,
        `  Pinned: ${note.isPinned ? 'yes' : 'no'}`,
        `  Shared: ${note.isShared ? 'yes' : 'no'}`,
        `  Content: ${note.content}`,
      ].join('\n'),
    );
  }

  private async updateNote(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const note = await this.getRequiredProjectNote(
      args[1],
      senderId,
      message,
      true,
    );
    const content = args.slice(2).join(' ').trim();

    if (!note) return;

    if (!content) {
      await this.reply(message, 'Usage: `*note update <id> <content...>`');
      return;
    }

    const updated = await this.noteService.updateNote(
      note.id,
      note.authorUserId,
      {
        content,
      },
    );

    await this.reply(
      message,
      `Updated note **#${updated.id}**: ${this.truncate(updated.content, 80)}`,
    );
  }

  private async deleteNote(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const note = await this.getRequiredProjectNote(
      args[1],
      senderId,
      message,
      true,
    );
    if (!note) return;

    await this.reply(
      message,
      [
        `🗑️ Are you sure you want to delete note **#${note.id}**?`,
        `Run: \`*note confirm delete ${note.id}\` to complete the deletion.`,
      ].join('\n'),
    );
  }

  private async confirmDeleteNote(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const note = await this.getRequiredProjectNote(
      args[2],
      senderId,
      message,
      true,
    );
    if (!note) return;

    await this.noteService.deleteNote(note.id, note.authorUserId);
    await this.reply(message, `Deleted note **#${note.id}**.`);
  }

  private async setNotePinned(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    isPinned: boolean,
  ): Promise<void> {
    const note = await this.getRequiredProjectNote(
      args[1],
      senderId,
      message,
      true,
    );
    if (!note) return;

    const updated = await this.noteService.pinNote(
      note.id,
      note.authorUserId,
      isPinned,
    );

    await this.reply(
      message,
      `Note **#${updated.id}** is now ${updated.isPinned ? 'pinned' : 'unpinned'}.`,
    );
  }

  private async setNoteShared(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    isShared: boolean,
  ): Promise<void> {
    const note = await this.getRequiredProjectNote(
      args[1],
      senderId,
      message,
      true,
    );
    if (!note) return;

    const updated = await this.noteService.shareNote(
      note.id,
      note.authorUserId,
      isShared,
    );

    await this.reply(
      message,
      `Note **#${updated.id}** is now ${updated.isShared ? 'shared' : 'private'}.`,
    );
  }

  private async getRequiredProjectNote(
    rawNoteId: string | undefined,
    senderId: string,
    message: ManagedMessage,
    requireAuthor: boolean,
  ): Promise<NoteEntity | null> {
    const noteId = this.parseId(rawNoteId);

    if (noteId == null) {
      await this.reply(message, 'Valid note ID is required.');
      return null;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const note = await this.noteService.getNoteById(noteId);

    if (!note || note.projectId !== context.projectId) {
      await this.reply(
        message,
        `Note #${noteId} not found in current project **${context.project.name}**.`,
      );
      return null;
    }

    if (requireAuthor && note.authorUserId !== context.user.id) {
      await this.reply(message, 'Permission denied.');
      return null;
    }

    return note;
  }

  private parseResourceType(
    value: string | undefined,
  ): NoteResourceType | null {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    const values = Object.values(NoteResourceType) as string[];
    return values.includes(normalized)
      ? (normalized as NoteResourceType)
      : null;
  }

  private parseId(value: string | undefined): number | null {
    if (!value) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private formatNoteFlags(note: NoteEntity): string {
    const flags = [
      note.isPinned ? 'pinned' : null,
      note.isShared ? 'shared' : 'private',
    ].filter(Boolean);

    return `[${flags.join(', ')}]`;
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength
      ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
      : value;
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

    return error instanceof Error ? error.message : 'Note command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
