import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'The project ID', example: 1 })
  @IsDefined()
  @IsInt()
  projectId!: number;

  @ApiPropertyOptional({
    description: 'User ID of the reporter',
    example: 'uuid-v4',
  })
  @IsOptional()
  @IsUUID()
  reporterUserId?: string;

  @ApiProperty({
    description: 'Title of the ticket',
    example: 'System crash on login',
  })
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Assigned team ID', example: 1 })
  @IsOptional()
  @IsInt()
  teamId?: number | null;

  @ApiPropertyOptional({ description: 'Assigned user ID', example: 'uuid-v4' })
  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;

  @ApiPropertyOptional({
    description: 'Detailed description of the issue',
    example: 'Steps to reproduce...',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    enum: TicketStatus,
    description: 'Current status of the ticket',
    default: TicketStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({
    enum: TicketSeverity,
    description: 'Severity level of the ticket',
    default: TicketSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(TicketSeverity)
  severity?: TicketSeverity;
}
