import { IsDefined, IsUUID } from 'class-validator';

export class AssignTaskDto {
  @IsDefined()
  @IsUUID()
  assigneeUserId!: string;
}
