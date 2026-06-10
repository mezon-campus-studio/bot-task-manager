import { IsDefined, IsOptional, IsUUID } from 'class-validator';

export class InviteProjectMemberDto {
  @IsDefined()
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  invitedByUserId?: string;
}
