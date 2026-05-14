import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AddTeamMemberDto {
  @ApiProperty({
    description: 'The user ID to add to the team',
    example: 'uuid-v4',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description: 'The user ID of the person who invited them',
    example: 'uuid-v4',
  })
  @IsOptional()
  @IsUUID()
  invitedBy?: string;
}
