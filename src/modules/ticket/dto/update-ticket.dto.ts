import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  TicketSeverity,
  TicketStatus,
} from '../enums';

export class UpdateTicketDto {
  @IsNumber()
  @IsOptional()
  projectId?: number;

  @IsNumber()
  @IsOptional()
  teamId?: number | null;

  @IsUUID()
  @IsOptional()
  assigneeUserId?: string | null;

  @IsUUID()
  @IsOptional()
  reporterUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @IsEnum(TicketSeverity)
  @IsOptional()
  severity?: TicketSeverity;
}