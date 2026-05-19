import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import {
  buildPaginationFooter,
  paginate,
} from '@src/common/utils/pagination.util';

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
              `┌─────────────────────────────`,
              `│ 📝 **Note Commands**`,
              `├─────────────────────────────`,
              `│ \`*note list [type] [resourceId] [--page N]\`           – List notes`,
              `│ \`*note create <type> <resourceId> <content...>\`   – Create a note`,
              `│ \`*note detail <id>\`                               – View note detail`,
              `│ \`*note update <id> <content...>\`                  – Update your note`,
              `│ \`*note delete <id>\`                               – Prepare deletion`,
              `│ \`*note confirm delete <id>\`                       – Confirm deletion`,
              `│ \`*note pin <id>\` / \`*note unpin <id>\`             – Pin / Unpin`,
              `│ \`*note share <id>\` / \`*note unshare <id>\`         – Share / Make private`,
              `├─────────────────────────────`,
              `│ Types: \`USER | PROJECT | TEAM | TASK | TICKET | EVENT\``,
              `└─────────────────────────────`,
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

    let page = 1;
    const pageFlagIndex = args.findIndex(
      (arg) => arg.toLowerCase() === '--page',
    );

    if (pageFlagIndex !== -1 && args[pageFlagIndex + 1]) {
      page = Math.max(1, parseInt(args[pageFlagIndex + 1], 10) || 1);
    } else {
      if (isFiltered) {
        page = Math.max(1, parseInt(args[3] ?? '1', 10) || 1);
      } else {
        page = Math.max(1, parseInt(args[1] ?? '1', 10) || 1);
      }
    }

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

    const filterLabel = isFiltered ? `${resourceType} / ${resourceId}` : 'All';

    if (!notes.length) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ 📝 **Note List**`,
          `├─────────────────────────────`,
          `│ 📁 Project  : ${context.project.name}`,
          `│ 🔎 Filter   : ${filterLabel}`,
          `├─────────────────────────────`,
          `│ ℹ️  No notes found.`,
          `│ Use \`*note create <type> <resourceId> <content>\` to create one.`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
      return;
    }

    const myNotes = notes.filter((n) => n.authorUserId === context.user.id);
    const sharedNotes = notes.filter(
      (n) => n.authorUserId !== context.user.id && n.isShared,
    );
    const managerOnlyNotes = isManager
      ? notes.filter(
          (n) =>
            n.authorUserId !== context.user.id &&
            !n.isShared &&
            n.resourceType !== NoteResourceType.USER,
        )
      : [];

    const { items: paginated, meta } = paginate(notes, page);

    const formatNoteLine = (n: NoteEntity) => {
      const pinTag = n.isPinned ? ' 📌' : '';
      const shareTag = n.isShared ? '🌐' : '🔒';
      const author = n.authorUser?.name ?? '—';
      const preview = this.truncate(n.content, 50);
      return [
        `│ ${shareTag}${pinTag} **#${n.id}** [${n.resourceType}:${n.resourceId}]`,
        `│     👤 ${author}  •  ${preview}`,
      ];
    };

    const lines: string[] = [
      `┌─────────────────────────────`,
      `│ 📝 **Note List**`,
      `├─────────────────────────────`,
      `│ 📁 Project  : ${context.project.name}`,
      `│ 🔎 Filter   : ${filterLabel}`,
      `├─────────────────────────────`,
    ];

    if (myNotes.length) {
      lines.push(`│ 📌 **My Notes**`);
      for (const n of paginated.filter(
        (n) => n.authorUserId === context.user.id,
      )) {
        lines.push(...formatNoteLine(n));
      }
      lines.push(`│`);
    }

    if (sharedNotes.length) {
      lines.push(`│ 🌐 **Shared Notes**`);
      for (const n of paginated.filter(
        (n) => n.authorUserId !== context.user.id && n.isShared,
      )) {
        lines.push(...formatNoteLine(n));
      }
      lines.push(`│`);
    }

    if (isManager && managerOnlyNotes.length) {
      lines.push(`│ 🔒 **Private Notes (Manager view)**`);
      for (const n of paginated.filter(
        (n) =>
          n.authorUserId !== context.user.id &&
          !n.isShared &&
          n.resourceType !== NoteResourceType.USER,
      )) {
        lines.push(...formatNoteLine(n));
      }
      lines.push(`│`);
    }

    lines.push(`├─────────────────────────────`);
    lines.push(
      `│ ${buildPaginationFooter(meta, isFiltered ? `*note list ${args[1]} ${resourceId}` : '*note list')}`,
    );
    lines.push(`│ 💡 \`*note detail <id>\` to view full content`);
    lines.push(`└─────────────────────────────`);

    await this.reply(message, lines.join('\n'));
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
        [
          `┌─────────────────────────────`,
          `│ ❌ **Missing required fields**`,
          `├─────────────────────────────`,
          `│ Usage: \`*note create <type> <resourceId> <content...>\``,
          `│ Types : \`USER | PROJECT | TEAM | TASK | TICKET | EVENT\``,
          `│ Example: \`*note create TASK 12 This needs more testing\``,
          `└─────────────────────────────`,
        ].join('\n'),
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
      [
        `┌─────────────────────────────`,
        `│ ✅ **Note Created**`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${note.id}`,
        `│ 🗂️  Resource : ${note.resourceType} / ${note.resourceId}`,
        `│ 🌐  Shared   : ${note.isShared ? 'Yes' : 'No (Private)'}`,
        `│ 📁  Project  : ${context.project.name}`,
        `│ 📄  Content  : ${this.truncate(note.content, 80)}`,
        `├─────────────────────────────`,
        `│ 💡 \`*note pin ${note.id}\` to pin  •  \`*note share ${note.id}\` to share`,
        `└─────────────────────────────`,
      ].join('\n'),
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
    const isOwnNote = note.authorUserId === context.user.id;

    if (!isManager && !isOwnNote && !note.isShared) {
      await this.reply(
        message,
        `❌ You don't have permission to view this note.`,
      );
      return;
    }

    if (
      isManager &&
      !isOwnNote &&
      note.resourceType === NoteResourceType.USER &&
      !note.isShared
    ) {
      await this.reply(
        message,
        `❌ You don't have permission to view this note.`,
      );
      return;
    }

    const pinTag = note.isPinned ? '📌 Pinned' : 'Not pinned';
    const shareTag = note.isShared ? '🌐 Shared' : '🔒 Private';

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 📝 **Note Detail**`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${note.id}`,
        `│ 🗂️  Resource : ${note.resourceType} / ${note.resourceId}`,
        `│ 👤  Author   : ${note.authorUser?.name ?? '—'}`,
        `│ 📌  Pin      : ${pinTag}`,
        `│ 🌐  Share    : ${shareTag}`,
        `│ 📅  Created  : ${this.formatDate(note.createdAt)}`,
        `│ 🔄  Updated  : ${this.formatDate(note.updatedAt)}`,
        `├─────────────────────────────`,
        `│ 📄 **Content:**`,
        `│ ${note.content}`,
        `├─────────────────────────────`,
        `│ 💡 \`*note update ${note.id} <content>\` to edit`,
        `└─────────────────────────────`,
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
      await this.reply(message, `❌ You can only update your own notes.`);
      return;
    }

    const content = args.slice(2).join(' ').trim();
    if (!content) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ❌ **Missing required fields**`,
          `├─────────────────────────────`,
          `│ Usage: \`*note update <id> <content...>\``,
          `│ Example: \`*note update 5 Updated content here\``,
          `└─────────────────────────────`,
        ].join('\n'),
      );
      return;
    }

    const updated = await this.noteService.updateNote(note.id, { content });
    if (!updated) {
      await this.reply(message, `❌ Note **#${note.id}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ✅ **Note Updated**`,
        `├─────────────────────────────`,
        `│ 🆔  ID      : #${updated.id}`,
        `│ 🗂️  Resource: ${updated.resourceType} / ${updated.resourceId}`,
        `│ 📄  Content : ${this.truncate(updated.content, 80)}`,
        `└─────────────────────────────`,
      ].join('\n'),
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
        `❌ You don't have permission to delete this note.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🗑️ **Confirm Delete Note**`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${note.id}`,
        `│ 🗂️  Resource : ${note.resourceType} / ${note.resourceId}`,
        `│ 👤  Author   : ${note.authorUser?.name ?? '—'}`,
        `│ 📄  Content  : ${this.truncate(note.content, 60)}`,
        `├─────────────────────────────`,
        `│ ⚠️  This action **cannot be undone**.`,
        `│ Run to confirm:`,
        `│ \`*note confirm delete ${note.id}\``,
        `└─────────────────────────────`,
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
        `❌ You don't have permission to delete this note.`,
      );
      return;
    }

    await this.noteService.deleteNote(note.id);

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🗑️ **Note Deleted**`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${note.id}`,
        `│ 🗂️  Resource : ${note.resourceType} / ${note.resourceId}`,
        `│ 📁  Project  : ${context.project.name}`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
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
        `❌ You don't have permission to pin/unpin this personal note.`,
      );
      return;
    }

    if (!isOwner && !isManager) {
      await this.reply(
        message,
        `❌ Only the note owner or a manager can pin/unpin notes.`,
      );
      return;
    }

    const updated = await this.noteService.pinNote(note.id, isPinned);
    if (!updated) {
      await this.reply(message, `❌ Note **#${note.id}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ${updated.isPinned ? '📌 **Note Pinned**' : '📌 **Note Unpinned**'}`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${updated.id}`,
        `│ 🗂️  Resource : ${updated.resourceType} / ${updated.resourceId}`,
        `│ 📌  Pin      : ${updated.isPinned ? 'Pinned' : 'Not pinned'}`,
        `└─────────────────────────────`,
      ].join('\n'),
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
        `❌ Only the note owner can change the sharing setting.`,
      );
      return;
    }

    const updated = await this.noteService.shareNote(note.id, isShared);
    if (!updated) {
      await this.reply(message, `❌ Note **#${note.id}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ${updated.isShared ? '🌐 **Note Shared**' : '🔒 **Note Made Private**'}`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${updated.id}`,
        `│ 🗂️  Resource : ${updated.resourceType} / ${updated.resourceId}`,
        `│ 🌐  Share    : ${updated.isShared ? 'Shared' : 'Private'}`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  // ─── helpers ────────────────────────────────────────────────────────────────
  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

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
