import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class TeamResponseDto {
  @ApiProperty({ description: 'The unique ID of the team', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({
    description: 'The project ID this team belongs to',
    example: 1,
  })
  @Expose()
  projectId: number;

  @ApiProperty({ description: 'The name of the team', example: 'Backend Team' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'The slug of the team', example: 'backend-team' })
  @Expose()
  slug: string;

  @ApiProperty({
    description: 'The user ID of the team leader',
    example: 'uuid-v4-string',
  })
  @Expose()
  leaderId: string;

  @ApiProperty({
    description: 'The description of the team',
    example: 'Core logic developers',
  })
  @Expose()
  description: string | null;

  @ApiProperty({ description: 'Whether this is the default team' })
  @Expose()
  isDefault: boolean;

  @ApiProperty({ description: 'Creation date' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  @Expose()
  updatedAt: Date;
}
