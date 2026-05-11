import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import EventEntity from './event.entity';
import { EventService } from './event.service';
import { EventRepository } from './event.repository';
import { EventController } from './event.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity])],
  providers: [EventService,  EventRepository],
  exports: [EventService, EventRepository],
  controllers: [EventController]
})
export class EventModule {}
