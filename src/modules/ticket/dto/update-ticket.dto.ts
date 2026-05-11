import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsDateString, // <--- Đảm bảo có import
} from 'class-validator';

import {
  TicketSeverity,
  TicketStatus,
  TicketPriority,
  TicketType,
} from '../enums';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsDateString() // <--- Validate nếu người dùng có truyền lên
  deadline?: string;

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