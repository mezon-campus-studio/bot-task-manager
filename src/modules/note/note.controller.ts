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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NoteResourceType } from './enums';
import { NoteService } from './note.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/decorators/auth-user.decorator';

@ApiTags('Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NoteController {
  constructor(private noteService: NoteService) {}

  @Post()
  async createNote(
    @AuthUser() userId: string,
    @Body() body: any,
  ) {
    const {
      content,
      projectId,
      resourceId,
      resourceType,
      isShared,
    } = body;
    return await this.noteService.createNote({
      authorUserId: userId,
      content,
      projectId,
      resourceId,
      resourceType,
      isShared,
    });
  }

  @Patch(':id')
  async updateNote(
    @AuthUser() userId: string,
    @Param('id', ParseIntPipe) noteId: number,
    @Body() body: any,
  ) {
    const { content, isShared, isPinned } = body;
    return await this.noteService.updateNote(noteId, userId, {
      content,
      isShared,
      isPinned,
    });
  }

  @Delete(':id')
  async deleteNote(
    @AuthUser() userId: string,
    @Param('id', ParseIntPipe) noteId: number,
  ) {
    await this.noteService.deleteNote(noteId, userId);
    return { success: true };
  }

  @Patch(':id/pin')
  async pinNote(
    @AuthUser() userId: string,
    @Param('id', ParseIntPipe) noteId: number,
    @Body() body: { isPinned: boolean },
  ) {
    return await this.noteService.updateNote(noteId, userId, {
      isPinned: body.isPinned,
    });
  }

  @Patch(':id/share')
  async shareNote(
    @AuthUser() userId: string,
    @Param('id', ParseIntPipe) noteId: number,
    @Body() body: { isShared: boolean },
  ) {
    return await this.noteService.updateNote(noteId, userId, {
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
