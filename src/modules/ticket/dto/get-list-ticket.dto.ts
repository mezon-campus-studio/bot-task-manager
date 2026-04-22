import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

import { TicketPriority, TicketStatus, TicketType } from '../enums';

export class GetListTicketDto {
  @IsOptional()
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsOptional()
  @IsEnum(TicketType)
  type: TicketType;

  @IsOptional()
  @IsString()
  search: string;
}
