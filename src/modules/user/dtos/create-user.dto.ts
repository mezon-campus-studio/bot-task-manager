import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'The unique Mezon ID of the user',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  mezonId: string;

  @ApiProperty({
    description: 'The display name of the user',
    example: 'John Doe',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'john@example.com',
  })
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  email: string;
}
