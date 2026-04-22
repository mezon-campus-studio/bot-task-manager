import { Type } from 'class-transformer';
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

export class CreateTicketDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  projectId: number;

  @IsUUID()
  @IsNotEmpty()
  reporterUserId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number | null;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketSeverity)
  severity?: TicketSeverity;
}
