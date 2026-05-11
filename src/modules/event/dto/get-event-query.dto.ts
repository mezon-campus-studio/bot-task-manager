import { IsEnum, IsOptional, IsUUID, IsNotEmpty, IsString, IsDateString } from 'class-validator';
import { EventStatus } from '../enums';
import {  IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetEventQueryDto {
  @IsUUID()
  @IsNotEmpty({ message: 'ProjectId is required to access events' })
  projectId: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  type?: string; // Nếu có nhiều loại event, có thể dùng trường này để phân loại

  @IsOptional()
  @IsDateString()
  fromDate?: string; 

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  title?: string; // Lọc theo tên (search)

  @IsOptional()
  @Type(() => Number) // Chuyển query string sang number
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 5;

}