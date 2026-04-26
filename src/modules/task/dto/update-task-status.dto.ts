import { IsDefined, IsEnum } from 'class-validator';
import { TaskStatus } from '../enums';

export class UpdateTaskStatusDto {
  @IsDefined()
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}
