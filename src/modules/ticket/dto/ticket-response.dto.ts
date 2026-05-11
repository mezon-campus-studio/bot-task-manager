import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { TicketSeverity, TicketStatus } from '../enums';

export class TicketResponseDto {
  @ApiProperty({ description: 'Unique ID of the ticket', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({
    description: 'The project ID this ticket belongs to',
    example: 1,
  })
  @Expose()
  projectId: number;

  @ApiProperty({
    description: 'The team ID assigned to this ticket',
    example: 1,
    nullable: true,
  })
  @Expose()
  teamId: number | null;

  @ApiProperty({
    description: 'The user ID of the assignee',
    example: 'uuid-v4',
    nullable: true,
  })
  @Expose()
  assigneeUserId: string | null;

  @ApiProperty({
    description: 'The user ID of the reporter',
    example: 'uuid-v4',
  })
  @Expose()
  reporterUserId: string;

  @ApiProperty({
    description: 'The title of the ticket',
    example: 'System crash',
  })
  @Expose()
  title: string;

  @ApiProperty({
    description: 'The detailed description',
    example: 'Full crash log...',
    nullable: true,
  })
  @Expose()
  description: string | null;

  @ApiProperty({ enum: TicketStatus, description: 'Current status' })
  @Expose()
  status: TicketStatus;

  @ApiProperty({ enum: TicketSeverity, description: 'Severity level' })
  @Expose()
  severity: TicketSeverity;

  @ApiProperty({ description: 'Creation date' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ description: 'Creator user ID', nullable: true })
  @Expose()
  createdBy: string | null;

  @ApiProperty({ description: 'Last updater user ID', nullable: true })
  @Expose()
  updatedBy: string | null;
}
