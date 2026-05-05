import {
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

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
}
