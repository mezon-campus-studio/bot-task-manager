import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsDateString, // <--- Thêm import này
} from 'class-validator';

import {
  TicketSeverity,
  TicketStatus,
  TicketPriority,
  TicketType,
} from '../enums';

export class CreateTicketDto {
  @IsNumber()
  @IsNotEmpty()
  projectId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsEnum(TicketType)
  @IsNotEmpty()
  type: TicketType;

  @IsEnum(TicketPriority)
  @IsNotEmpty()
  priority: TicketPriority;

  @IsDateString() // <--- Validate định dạng ISO8601 (VD: 2024-12-31)
  @IsNotEmpty()
  deadline: string;

  @IsOptional()
  @IsString()
  description: string | null;

  @IsEnum(TicketStatus)
  @IsOptional()
  status: TicketStatus;

  @IsEnum(TicketSeverity)
  @IsOptional()
  severity: TicketSeverity;

  @IsUUID()
  @IsNotEmpty()
  reporterUserId: string;

  @IsUUID()
  @IsOptional()
  assigneeUserId: string | null;

  @IsNumber()
  @IsOptional()
  teamId: number | null;
}