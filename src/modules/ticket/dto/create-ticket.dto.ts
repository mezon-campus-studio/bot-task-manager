import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  TicketPriority,
  TicketType,
} from '../enums';

export class CreateTicketDto {
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsEnum(TicketType)
  type: TicketType;

  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsDateString()
  dueDate: string;
}