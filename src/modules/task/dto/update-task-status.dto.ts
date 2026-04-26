import { IsDefined, IsEnum, IsUUID } from 'class-validator';
import { TaskStatus } from '../enums';

export class UpdateTaskStatusDto {
  @IsDefined()
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsDefined()
  @IsUUID()
  authorUserId!: string;
}
