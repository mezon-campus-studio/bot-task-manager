import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import {
  TicketPriority,
  TicketType,
  TicketSeverity,
  TicketStatus,
} from '../enums';

export class CreateTicketDto {
  @IsNumber()
  @IsNotEmpty()
  projectId: number; // hoặc đổi sang UUID nếu cần

  @IsOptional()
  @IsNumber()
  teamId?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assigneeUserId?: string | null;

  @IsUUID()
  @IsNotEmpty()
  reporterUserId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsEnum(TicketType)
  type: TicketType;

  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsEnum(TicketSeverity)
  severity: TicketSeverity;
}