import {
  IsDefined,
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
  @IsDefined()
  @IsInt()
  projectId!: number;

  @IsDefined()
  @IsUUID()
  reporterUserId!: string;

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
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
