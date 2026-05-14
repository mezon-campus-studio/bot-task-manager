import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@src/modules/auth/guards/jwt-auth.guard';
import UserEntity from '@src/modules/user/user.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketResponseDto } from './dto/ticket-response.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketSeverity, TicketStatus } from './enums';
import { TicketService } from './ticket.service';

@Controller('tickets')
@ApiTags('Tickets')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  async createTicket(
    @CurrentUser() user: UserEntity,
    @Body() body: CreateTicketDto,
  ): Promise<TicketResponseDto> {
    const ticket = await this.ticketService.createTicket({
      ...body,
      reporterUserId: body.reporterUserId ?? user.id,
    });
    return plainToInstance(TicketResponseDto, ticket, {
      excludeExtraneousValues: true,
    });
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all tickets in a project' })
  async getListTicket(
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<TicketResponseDto[]> {
    const tickets = await this.ticketService.getListTicket(projectId);
    return plainToInstance(TicketResponseDto, tickets, {
      excludeExtraneousValues: true,
    });
  }

  @Get('project/:projectId/:id')
  @ApiOperation({ summary: 'Get details of a specific ticket' })
  async getDetailTicket(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TicketResponseDto> {
    const ticket = await this.ticketService.getDetailTicket(projectId, id);
    return plainToInstance(TicketResponseDto, ticket, {
      excludeExtraneousValues: true,
    });
  }

  @Patch('project/:projectId/:id')
  @ApiOperation({ summary: 'Update ticket information' })
  async updateTicket(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTicketDto,
  ): Promise<TicketResponseDto> {
    const ticket = await this.ticketService.updateTicket(projectId, id, body);
    return plainToInstance(TicketResponseDto, ticket, {
      excludeExtraneousValues: true,
    });
  }

  @Delete('project/:projectId/:id')
  @ApiOperation({ summary: 'Delete a ticket' })
  async deleteTicket(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<boolean> {
    return this.ticketService.deleteTicket(projectId, id);
  }

  @Get('project/:projectId/status/:status')
  @ApiOperation({ summary: 'Get tickets by status' })
  async getByStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('status', new ParseEnumPipe(TicketStatus)) status: TicketStatus,
  ): Promise<TicketResponseDto[]> {
    const tickets = await this.ticketService.getByStatus(projectId, status);
    return plainToInstance(TicketResponseDto, tickets, {
      excludeExtraneousValues: true,
    });
  }

  @Get('project/:projectId/assignee/:userId')
  @ApiOperation({ summary: 'Get tickets assigned to a specific user' })
  async getByAssignee(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<TicketResponseDto[]> {
    const tickets = await this.ticketService.getByAssignee(projectId, userId);
    return plainToInstance(TicketResponseDto, tickets, {
      excludeExtraneousValues: true,
    });
  }

  @Get('project/:projectId/my-tickets')
  @ApiOperation({ summary: 'Get tickets assigned to the current user' })
  async getMyTickets(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: UserEntity,
  ): Promise<TicketResponseDto[]> {
    const tickets = await this.ticketService.getByAssignee(projectId, user.id);
    return plainToInstance(TicketResponseDto, tickets, {
      excludeExtraneousValues: true,
    });
  }

  @Get('project/:projectId/severity/:severity')
  @ApiOperation({ summary: 'Get tickets by severity level' })
  async getBySeverity(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('severity', new ParseEnumPipe(TicketSeverity))
    severity: TicketSeverity,
  ): Promise<TicketResponseDto[]> {
    const tickets = await this.ticketService.getBySeverity(projectId, severity);
    return plainToInstance(TicketResponseDto, tickets, {
      excludeExtraneousValues: true,
    });
  }
}
