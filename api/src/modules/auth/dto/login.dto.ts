import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@peoplepay360.com' })
  @IsEmail({}, { message: 'A valid email address is required.' })
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(1, { message: 'Password is required.' })
  password!: string;
}
