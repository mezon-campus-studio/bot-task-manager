import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddTeamMemberDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsUUID()
  invitedBy: string;
}
