import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketSeverity, TicketStatus } from './enums';
import { TicketService } from './ticket.service';

@Controller('tickets')
@ApiTags('Tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  async createTicket(@Body() body: CreateTicketDto) {
    return this.ticketService.createTicket(body);
  }

  @Get('project/:projectId')
  async getListTicket(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.ticketService.getListTicket(projectId);
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

  @Get('project/:projectId/status/:status')
  async getByStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('status') status: TicketStatus,
  ) {
    return this.ticketService.getByStatus(projectId, status);
  }

  @Get('project/:projectId/assignee/:userId')
  async getByAssignee(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId') userId: string,
  ) {
    return this.ticketService.getByAssignee(projectId, userId);
  }

  @Get('project/:projectId/severity/:severity')
  async getBySeverity(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('severity') severity: TicketSeverity,
  ) {
    return this.ticketService.getBySeverity(projectId, severity);
  }
}
