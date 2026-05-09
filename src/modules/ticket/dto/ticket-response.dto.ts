import { Expose } from 'class-transformer';
import { TicketSeverity, TicketStatus } from '../enums';

export class TicketResponseDto {
  @Expose()
  id: number;

  @Expose()
  projectId: number;

  @Expose()
  teamId: number | null;

  @Expose()
  assigneeUserId: string | null;

  @Expose()
  reporterUserId: string;

  @Expose()
  title: string;

  @Expose()
  description: string | null;

  @Expose()
  status: TicketStatus;

  @Expose()
  severity: TicketSeverity;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  createdBy: string | null;

  @Expose()
  updatedBy: string | null;
}
