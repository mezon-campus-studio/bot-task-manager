import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import {
  TicketPriority,
  TicketSeverity,
  TicketStatus,
  TicketType,
} from '../enums';

export class UpdateTicketDto {
  @IsOptional()
  @IsNumber()
  projectId?: number; // hoặc UUID nếu project dùng UUID

  @IsOptional()
  @IsNumber()
  teamId?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assigneeUserId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsUUID()
  reporterUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(TicketSeverity)
  severity?: TicketSeverity;
}