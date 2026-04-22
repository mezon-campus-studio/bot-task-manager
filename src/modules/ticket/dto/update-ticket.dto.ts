import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { TicketSeverity, TicketStatus } from '../enums';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketSeverity)
  severity?: TicketSeverity;

  @IsOptional()
  @IsInt()
  teamId?: number | null;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;
}
