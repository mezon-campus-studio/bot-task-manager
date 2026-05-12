import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateEventInput } from './event.service';
import { EventService } from './event.service';
import { GetEventQueryDto } from './dto/get-event-query.dto';

@Controller('events')
@ApiTags('Events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  async createEvent(@Body() body: CreateEventInput) {
    return this.eventService.createEvent(body);
  }

  @Get()
  async getEvents(@Query() query: GetEventQueryDto) {
    return this.eventService.findEvents(query);
  }

  @Get('project/:projectId')
async getEventsByProject(
  @Param('projectId', ParseIntPipe) projectId: number, // Đổi Pipe và kiểu dữ liệu sang number
) {
  return this.eventService.listByProject(projectId);
}

  @Get()
async findAll(@Query() query: GetEventQueryDto) {
  return this.eventService.findEvents(query);
  }
  
}