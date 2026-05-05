import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class AssignTicketDto {
  @ValidateIf(
    (o) =>
      o.assigneeUserId !== undefined &&
      o.assigneeUserId !== null,
  )
  @IsUUID()
  @IsNotEmpty()
  @IsOptional()
  assigneeUserId?: string | null;

  @ValidateIf(
    (o) => o.assigneeId !== undefined && o.assigneeId !== null,
  )
  @IsUUID()
  @IsNotEmpty()
  @IsOptional()
  assigneeId?: string | null;
}
