import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { TeamMemberStatus } from '../enums/team-member-status.enum';

export class TeamMemberResponseDto {
  @ApiProperty({ description: 'The unique ID of the membership', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: 'The team ID', example: 1 })
  @Expose()
  teamId: number;

  @ApiProperty({ description: 'The user ID', example: 'uuid-v4' })
  @Expose()
  userId: string;

  @ApiProperty({
    enum: TeamMemberStatus,
    description: 'Current status of the member',
  })
  @Expose()
  status: TeamMemberStatus;

  @ApiProperty({
    description: 'The user ID of the person who invited them',
    example: 'uuid-v4',
    nullable: true,
  })
  @Expose()
  invitedByUserId: string | null;

  @ApiProperty({
    description: 'When the member joined the team',
    nullable: true,
  })
  @Expose()
  joinedAt: Date | null;

  @ApiProperty({ description: 'Creation date' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  @Expose()
  updatedAt: Date;
}
