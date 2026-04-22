import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { TicketSeverity, TicketStatus } from '../enums';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
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
  @Type(() => Number)
  @IsInt()
  teamId?: number | null;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;
}
