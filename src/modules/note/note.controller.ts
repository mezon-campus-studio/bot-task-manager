import { Body, Controller, Post } from '@nestjs/common';
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
}
