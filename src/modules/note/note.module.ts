import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import NoteEntity from './note.entity';
import { NoteService } from './note.service';

@Module({
  imports: [TypeOrmModule.forFeature([NoteEntity])],
  providers: [NoteService],
  exports: [NoteService],
})
export class NoteModule {}
