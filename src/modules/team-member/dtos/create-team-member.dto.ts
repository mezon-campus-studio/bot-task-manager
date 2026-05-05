import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { TeamMemberStatus } from '../enums/team-member-status.enum';

export class CreateTeamMemberDto {
  @IsNotEmpty()
  @IsInt()
  teamId!: number;

  @IsNotEmpty()
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsEnum(TeamMemberStatus)
  status?: TeamMemberStatus;

  @IsOptional()
  @IsUUID()
  invitedByUserId?: string;

  @IsOptional()
  joinedAt?: Date;
}
