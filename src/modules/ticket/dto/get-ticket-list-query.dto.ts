import { IsEnum, IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';
import { TicketStatus, TicketType, TicketPriority } from '../enums';

export class GetTicketListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

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
  deadline?: string;
}