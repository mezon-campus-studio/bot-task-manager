import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import { NoteCommandHandler } from './note-command.handler';
import { NoteController } from './note.controller';
import NoteEntity from './note.entity';
import { NoteService } from './note.service';

@Module({
  imports: [TypeOrmModule.forFeature([NoteEntity]), AuthModule, ProjectModule],
  controllers: [NoteController],
  providers: [NoteService, NoteCommandHandler],
  exports: [NoteService],
})
export class NoteModule {}
