import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import { EventCommandHandler } from './event-command.handler';
import EventEntity from './event.entity';
import { EventService } from './event.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity]), AuthModule, ProjectModule],
  providers: [EventCommandHandler, EventService],
  exports: [EventService],
})
export class EventModule {}
