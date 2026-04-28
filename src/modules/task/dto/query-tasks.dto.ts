import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { AppPaginateOptionsDto } from '@src/common/dtos/page-options.dto';
import { SearchOrder } from '@src/common/enums';
import { TaskPriority, TaskStatus } from '../enums';

export class QueryTasksDto extends AppPaginateOptionsDto {
  @IsOptional()
  @IsEnum(SearchOrder)
  readonly order: SearchOrder = SearchOrder.ASC;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  readonly page: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  readonly take: number = 10;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  teamId?: number;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsUUID()
  reporterUserId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
}
