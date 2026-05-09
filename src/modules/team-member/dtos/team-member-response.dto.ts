import { Expose } from 'class-transformer';
import { TeamMemberStatus } from '../enums/team-member-status.enum';

export class TeamMemberResponseDto {
  @Expose()
  id: number;

  @Expose()
  teamId: number;

  @Expose()
  userId: string;

  @Expose()
  status: TeamMemberStatus;

  @Expose()
  invitedByUserId: string | null;

  @Expose()
  joinedAt: Date | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
