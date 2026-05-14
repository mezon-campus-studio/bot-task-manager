import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { NoteController } from './note.controller';
import NoteEntity from './note.entity';
import { NoteService } from './note.service';
import { NoteMessageHandler } from './note.handler';

@Module({
  imports: [TypeOrmModule.forFeature([NoteEntity]), AuthModule],
  controllers: [NoteController],
  providers: [NoteService, NoteMessageHandler],
  exports: [NoteService],
})
export class NoteModule {}
