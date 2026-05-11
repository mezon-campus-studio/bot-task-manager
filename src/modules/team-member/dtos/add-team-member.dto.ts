import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddTeamMemberDto {
  @ApiProperty({
    description: 'The user ID to add to the team',
    example: 'uuid-v4',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'The user ID of the person who invited them',
    example: 'uuid-v4',
  })
  @IsNotEmpty()
  @IsUUID()
  invitedBy: string;
}
