import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../enums';

export class UpdateTicketDto {
  @IsOptional()
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsEnum(TicketType)
  type: TicketType;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsOptional()
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsDateString()
  dueDate: string;
}