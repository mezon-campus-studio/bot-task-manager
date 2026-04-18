import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskPriority, TaskStatus, TaskType } from '../task.enum';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
