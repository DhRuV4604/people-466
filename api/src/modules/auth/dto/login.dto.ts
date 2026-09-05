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

export class ChangePasswordDto {
  @ApiProperty({ description: 'The password currently in use, issued or chosen' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8, description: 'The replacement' })
  @IsString()
  @MinLength(8, { message: 'A password must be at least 8 characters.' })
  newPassword!: string;
}
