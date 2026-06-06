import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeTokenDto {
  @ApiProperty({ description: 'OAuth authorization code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'OAuth state parameter for CSRF protection' })
  @IsString()
  @IsNotEmpty()
  state!: string;
}
