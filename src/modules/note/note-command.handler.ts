import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
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
import { NoteListFilter, NoteService } from './note.service';

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
              '📝 **Note Commands:**',
              '  `*note list [resourceType] [resourceId]` – List notes',
              '  `*note create <resourceType> <resourceId> <content...>` – Create a note',
              '  `*note detail <id>` – View note detail',
              '  `*note update <id> <content...>` – Update your note',
              '  `*note delete <id>` – Prepare delete confirmation',
              '  `*note confirm delete <id>` – Confirm note deletion',
              '  `*note pin <id>` / `*note unpin <id>` – Pin or unpin a note',
              '  `*note share <id>` / `*note unshare <id>` – Share or unshare your note',
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
    const isFiltered = !!resourceType && !!resourceId;

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const filter = this.buildListFilter(context);
    const isManager = this.isManager(context);

    const notes = isFiltered
      ? await this.noteService.listByResource(
          context.projectId,
          resourceType as NoteResourceType,
          resourceId as string,
          filter,
        )
      : await this.noteService.listByProject(context.projectId, filter);

    if (!notes.length) {
      const where = isFiltered
        ? `for ${resourceType} **${resourceId}** in project **${context.project.name}**`
        : `in project **${context.project.name}**`;
      await this.reply(message, `No notes found ${where}.`);
      return;
    }

    const myNotes = notes.filter(
      (note) => note.authorUserId === context.user.id,
    );

    const sharedNotes = notes.filter(
      (note) => note.authorUserId !== context.user.id && note.isShared === true,
    );

    const managerOnlyNotes = isManager
      ? notes.filter(
          (note) =>
            note.authorUserId !== context.user.id &&
            note.isShared === false &&
            note.resourceType !== NoteResourceType.USER,
        )
      : [];

    const formatLine = (note: NoteEntity) => {
      return `  [#${note.id}] - ${this.formatNoteFlags(note).toUpperCase()} - [Type: ${note.resourceType.toUpperCase()}] - [Resource: ${note.resourceId}] - [Author: ${note.authorUser?.name || 'Unknown'}] - [${note.createdAt.toLocaleString()}]`;
    };

    const outputLines: string[] = [];

    const header = isFiltered
      ? `📝 **Notes for ${resourceType} [${resourceId}] in project *${context.project.name}*:**`
      : `📝 **All available notes in project *${context.project.name}*:**`;
    outputLines.push(header);

    outputLines.push('\n📌 **MY NOTES (Ghi chú của tôi):**');
    if (myNotes.length > 0) {
      outputLines.push(...myNotes.map(formatLine));
    } else {
      outputLines.push("  *(You haven't created any notes yet)*");
    }

    outputLines.push('\n🌐 **SHARED NOTES (Ghi chú được chia sẻ công khai):**');
    if (sharedNotes.length > 0) {
      outputLines.push(...sharedNotes.map(formatLine));
    } else {
      outputLines.push('  *(No public shared notes from others)*');
    }

    if (isManager) {
      outputLines.push('\n🔒 **PRIVATE NOTES (Chỉ manager mới thấy):**');
      if (managerOnlyNotes.length > 0) {
        outputLines.push(...managerOnlyNotes.map(formatLine));
      } else {
        outputLines.push('  *(No private notes from others)*');
      }
    }

    await this.reply(message, outputLines.join('\n'));
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

    const isSharedDefault = resourceType !== NoteResourceType.USER;

    const note = await this.noteService.createNote({
      authorUserId: context.user.id,
      content,
      projectId: context.projectId,
      resourceId,
      resourceType,
      isShared: isSharedDefault,
    });

    await this.reply(
      message,
      `✅ Created note **#${note.id}** for ${resourceType} **${resourceId}** in project **${context.project.name}**.`,
    );
  }

  private async detailNote(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const note = await this.getRequiredNote(
      args[1],
      context.projectId,
      message,
    );
    if (!note) return;

    const isManager = this.isManager(context);

    if (!isManager) {
      const isOwnNote = note.authorUserId === context.user.id;

      const isVisibleOtherNote = note.isShared === true;

      if (!isOwnNote && !isVisibleOtherNote) {
        await this.reply(
          message,
          '❌ You do not have permission to view this note.',
        );
        return;
      }
    }

    if (
      isManager &&
      note.authorUserId !== context.user.id &&
      note.resourceType === NoteResourceType.USER &&
      !note.isShared
    ) {
      await this.reply(
        message,
        '❌ You do not have permission to view this note.',
      );
      return;
    }

    await this.reply(
      message,
      [
        `📄 Note #${note.id}`,
        `  Resource: ${note.resourceType} ${note.resourceId}`,
        `  Author: ${note.authorUser?.name ?? note.authorUserId}`,
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
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const note = await this.getRequiredNote(
      args[1],
      context.projectId,
      message,
    );
    if (!note) return;

    if (note.authorUserId !== context.user.id) {
      await this.reply(message, '❌ You can only update your own notes.');
      return;
    }

    const content = args.slice(2).join(' ').trim();
    if (!content) {
      await this.reply(message, 'Usage: `*note update <id> <content...>`');
      return;
    }

    const updated = await this.noteService.updateNote(note.id, { content });
    if (!updated) {
      await this.reply(message, `Note #${note.id} not found.`);
      return;
    }

    await this.reply(
      message,
      `✅ Updated note **#${updated.id}**: ${this.truncate(updated.content, 80)}`,
    );
  }

  private async deleteNote(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const note = await this.getRequiredNote(
      args[1],
      context.projectId,
      message,
    );
    if (!note) return;

    if (!this.canDelete(note, context)) {
      await this.reply(
        message,
        '❌ You do not have permission to delete this note.',
      );
      return;
    }

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
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const note = await this.getRequiredNote(
      args[2],
      context.projectId,
      message,
    );
    if (!note) return;

    if (!this.canDelete(note, context)) {
      await this.reply(
        message,
        '❌ You do not have permission to delete this note.',
      );
      return;
    }

    await this.noteService.deleteNote(note.id);
    await this.reply(message, `🗑️ Deleted note **#${note.id}**.`);
  }

  private async setNotePinned(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    isPinned: boolean,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const note = await this.getRequiredNote(
      args[1],
      context.projectId,
      message,
    );
    if (!note) return;

    const isOwner = note.authorUserId === context.user.id;
    const isManager = this.isManager(context);

    if (note.resourceType === NoteResourceType.USER && !isOwner) {
      await this.reply(
        message,
        '❌ You do not have permission to pin/unpin this personal note.',
      );
      return;
    }

    if (!isOwner && !isManager) {
      await this.reply(
        message,
        '❌ Only the note owner or a manager can pin/unpin notes.',
      );
      return;
    }

    const updated = await this.noteService.pinNote(note.id, isPinned);
    if (!updated) {
      await this.reply(message, `Note #${note.id} not found.`);
      return;
    }

    await this.reply(
      message,
      `✅ Note **#${updated.id}** is now ${updated.isPinned ? 'pinned' : 'unpinned'}.`,
    );
  }

  private async setNoteShared(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    isShared: boolean,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const note = await this.getRequiredNote(
      args[1],
      context.projectId,
      message,
    );
    if (!note) return;

    if (note.authorUserId !== context.user.id) {
      await this.reply(
        message,
        '❌ Only the note owner can change the sharing setting.',
      );
      return;
    }

    const updated = await this.noteService.shareNote(note.id, isShared);
    if (!updated) {
      await this.reply(message, `Note #${note.id} not found.`);
      return;
    }

    await this.reply(
      message,
      `✅ Note **#${updated.id}** is now ${updated.isShared ? 'shared' : 'private'}.`,
    );
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private async getRequiredNote(
    rawNoteId: string | undefined,
    projectId: number,
    message: ManagedMessage,
  ): Promise<NoteEntity | null> {
    const noteId = this.parseId(rawNoteId);
    if (noteId == null) {
      await this.reply(message, 'Valid note ID is required.');
      return null;
    }

    const note = await this.noteService.getNoteById(noteId);
    if (!note || note.projectId !== projectId) {
      await this.reply(
        message,
        `Note #${noteId} not found in current project.`,
      );
      return null;
    }

    return note;
  }

  private canDelete(note: NoteEntity, context: any): boolean {
    const isOwner = note.authorUserId === context.user.id;
    if (isOwner) return true;

    if (
      this.isManager(context) &&
      note.resourceType !== NoteResourceType.USER
    ) {
      return true;
    }

    return false;
  }

  private isManager(context: any): boolean {
    const role = Number(context.user?.role);
    return role === UserRole.ADMIN || role === UserRole.PM;
  }

  private buildListFilter(context: any): NoteListFilter {
    return {
      callerId: context.user.id as string,
      isManager: this.isManager(context),
    };
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
      ? `${value.slice(0, maxLength - 3)}...`
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
        const msg = (response as any).message;
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
