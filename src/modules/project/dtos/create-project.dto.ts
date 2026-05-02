import { Type } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ProjectOnboardingStatus } from '../project.enums';

export class CreateProjectDto {
  @IsDefined()
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsDefined()
  @IsString()
  @MaxLength(255)
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsDefined()
  @IsUUID()
  ownerUserId!: string;

  @IsOptional()
  @IsEnum(ProjectOnboardingStatus)
  onboardingStatus?: ProjectOnboardingStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  onboardingCompletedAt?: Date | null;
}
