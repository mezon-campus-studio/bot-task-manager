import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketStatus, TicketSeverity, TicketType, TicketPriority } from '../enums';

export class GetTicketQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketSeverity)
  severity?: TicketSeverity;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}