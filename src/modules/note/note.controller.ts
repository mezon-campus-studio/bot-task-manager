import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NoteResourceType } from './enums';
import { NoteService } from './note.service';

@Controller('notes')
export class NoteController {
  constructor(private noteService: NoteService) {}

  @Post()
  async createNote(@Body() body: any) {
    const {
      authorUserId,
      content,
      projectId,
      resourceId,
      resourceType,
      isShared,
    } = body;
    return await this.noteService.createNote({
      authorUserId,
      content,
      projectId,
      resourceId,
      resourceType,
      isShared,
    });
  }

  @Patch(':id')
  async updateNote(
    @Param('id', ParseIntPipe) noteId: number,
    @Body() body: any,
  ) {
    const { userId, content, isShared, isPinned } = body;
    return await this.noteService.updateNote(noteId, userId, {
      content,
      isShared,
      isPinned,
    });
  }

  @Delete(':id')
  async deleteNote(
    @Param('id', ParseIntPipe) noteId: number,
    @Body('userId') userId: string,
  ) {
    await this.noteService.deleteNote(noteId, userId);
    return { success: true };
  }

  @Patch(':id/pin')
  async pinNote(
    @Param('id', ParseIntPipe) noteId: number,
    @Body()
    body: {
      userId: string;
      isPinned: boolean;
    },
  ) {
    return await this.noteService.updateNote(noteId, body.userId, {
      isPinned: body.isPinned,
    });
  }

  @Patch(':id/share')
  async shareNote(
    @Param('id', ParseIntPipe) noteId: number,
    @Body()
    body: {
      userId: string;
      isShared: boolean;
    },
  ) {
    return await this.noteService.updateNote(noteId, body.userId, {
      isShared: body.isShared,
    });
  }

  @Get('resource/:projectId/:resourceType/:resourceId')
  async getNotesByResource(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('resourceType') resourceType: NoteResourceType,
    @Param('resourceId') resourceId: string,
  ) {
    return await this.noteService.listByResource(
      projectId,
      resourceType,
      resourceId,
    );
  }

  @Get()
  QueryNotesByResource(
    @Query()
    query: {
      projectId: number;
      resourceType: NoteResourceType;
      resourceId: string;
      isPinned?: boolean;
      isShared?: boolean;
      page?: number;
      keyword?: string;
      limit?: number;
    },
  ) {
    return this.noteService.listByResourceWithPagination(query);
  }
}
