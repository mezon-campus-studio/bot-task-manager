import {
  BadRequestException,
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
import { AssignTicketDto } from './dto/assign-ticket.dto';

import {
  TicketSeverity,
  TicketStatus,
} from './enums';

@Controller('tickets')
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
    //xác thực id
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
    //tạo payload mới để có thể update cả trường assigneeUserId và assigneeId, nếu có trường nào thì sẽ update trường đó
    const payload = {
      ...body,
      assigneeUserId:
        body.assigneeUserId ?? body.assigneeId,
    };

    if ('assigneeId' in payload) {
      delete payload.assigneeId;
    }

    return await this.ticketService.updateTicket(
      Number(projectId),
      Number(id),
      payload,
    );
  }

  @Patch('project/:projectId/:id/assign')
  async assignTicket(
    @Param('projectId') projectId: number,
    @Param('id') id: number,
    @Body() body: AssignTicketDto,
  ) {
    const assigneeUserId =
      body.assigneeUserId ?? body.assigneeId;

    if (assigneeUserId === undefined) {
      throw new BadRequestException(
        'assigneeId or assigneeUserId is required',
      );
    }

    return await this.ticketService.assignTicket(
      Number(projectId),
      Number(id),
      assigneeUserId,
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
    @Param('severity') severity: TicketSeverity,
  ) {
    return await this.ticketService.getBySeverity(
      Number(projectId),
      severity,
    );
  }
}