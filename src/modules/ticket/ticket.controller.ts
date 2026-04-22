import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { TicketService } from './ticket.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

import {
  TicketSeverity,
  TicketStatus,
} from './enums';

@Controller('tickets')/
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
  ) {}

  @Post()
  async createTicket(
    @Body() body: CreateTicketDto,
  ) {
    return await this.ticketService.createTicket(
      body,
    );
  }

  @Get('project/:projectId')
  async getListTicket(
    @Param('projectId') projectId: number,
  ) {
    return await this.ticketService.getListTicket(
      Number(projectId),
    );
  }

  @Get('project/:projectId/:id')
  async getDetailTicket(
    @Param('projectId') projectId: number,
    @Param('id') id: number,
  ) {
    return await this.ticketService.getDetailTicket(
      Number(projectId),
      Number(id),
    );
  }

  @Patch('project/:projectId/:id')
  async updateTicket(
    @Param('projectId') projectId: number,
    @Param('id') id: number,
    @Body() body: UpdateTicketDto,
  ) {
    return await this.ticketService.updateTicket(
      Number(projectId),
      Number(id),
      body,
    );
  }

  @Delete('project/:projectId/:id')
  async deleteTicket(
    @Param('projectId') projectId: number,
    @Param('id') id: number,
  ) {
    return await this.ticketService.deleteTicket(
      Number(projectId),
      Number(id),
    );
  }

  @Get('project/:projectId/status/:status')
  async getByStatus(
    @Param('projectId') projectId: number,
    @Param('status') status: TicketStatus,
  ) {
    return await this.ticketService.getByStatus(
      Number(projectId),
      status,
    );
  }

  @Get(
    'project/:projectId/assignee/:userId',
  )
  async getByAssignee(
    @Param('projectId') projectId: number,
    @Param('userId') userId: string,
  ) {
    return await this.ticketService.getByAssignee(
      Number(projectId),
      userId,
    );
  }

  @Get(
    'project/:projectId/severity/:severity',
  )
  async getBySeverity(
    @Param('projectId') projectId: number,
    @Param('severity')
    severity: TicketSeverity,
  ) {
    return await this.ticketService.getBySeverity(
      Number(projectId),
      severity,
    );
  }
}