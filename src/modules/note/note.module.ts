import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingDeletionService } from '@src/common/providers/pending-deletion.service';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import { NoteCommandHandler } from './note-command.handler';
import NoteEntity from './note.entity';
import { NoteService } from './note.service';
@Module({
  imports: [TypeOrmModule.forFeature([NoteEntity]), AuthModule, ProjectModule],
  providers: [NoteService, NoteCommandHandler, PendingDeletionService],
  exports: [NoteService],
})
export class NoteModule {}
