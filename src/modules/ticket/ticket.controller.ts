import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query, // Thêm Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { GetTicketQueryDto } from './dto/get-ticket-query.dto'; // Import mới
import { TicketService } from './ticket.service';

@Controller('tickets')
@ApiTags('Tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  async createTicket(@Body() body: CreateTicketDto) {
    return this.ticketService.createTicket(body);
  }

  // Gộp các route filter vào đây bằng Query Params
  // Ví dụ: /tickets/project/1?status=OPEN&severity=HIGH
  @Get('project/:projectId')
  async getListTicket(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: GetTicketQueryDto, 
  ) {
    return this.ticketService.getListTicket(projectId, query);
  }

  @Get('project/:projectId/:id')
  async getDetailTicket(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ticketService.getDetailTicket(projectId, id);
  }

  @Patch('project/:projectId/:id')
  async updateTicket(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTicketDto,
  ) {
    return this.ticketService.updateTicket(projectId, id, body);
  }

  @Delete('project/:projectId/:id')
  async deleteTicket(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ticketService.deleteTicket(projectId, id);
  }
}