import {
  IsEnum,
  IsNotEmpty,
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

export class CreateTicketDto {
  @IsNumber()
  @IsNotEmpty()
  projectId: number;

  @IsNumber()
  @IsOptional()
  teamId: number | null;

  @IsUUID()
  @IsOptional()
  assigneeUserId: string | null;

  @IsUUID()
  @IsNotEmpty()
  reporterUserId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description: string | null;

  @IsEnum(TicketStatus)
  @IsOptional()
  status: TicketStatus;

  @IsEnum(TicketSeverity)
  @IsOptional()
  severity: TicketSeverity;
}