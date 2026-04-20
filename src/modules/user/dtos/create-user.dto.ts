import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  email: string;
}
