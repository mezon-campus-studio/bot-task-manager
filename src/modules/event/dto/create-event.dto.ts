import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length, Min, IsDateString } from 'class-validator';
import { EventStatus } from '../enums';

export class CreateEventDto {

  @IsUUID()
  @IsNotEmpty()
  projectId: string; // Đảm bảo scope ngay từ khi tạo

  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus = EventStatus.DRAFT;

  @IsDateString()
  @IsNotEmpty()
  startsAt: string;

  @IsDateString()
  @IsNotEmpty()
  endsAt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  reminder?: number;

  @IsOptional()
  @IsString()
  location?: string;
}