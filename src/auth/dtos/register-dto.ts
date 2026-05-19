import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address used for authentication',
  })
  @IsEmail()
  public readonly email: string;

  @ApiProperty({
    example: '123456',
    minLength: 6,
    description: 'User password with a minimum length of 6 characters',
  })
  @IsString()
  @MinLength(6)
  public readonly password: string;

  @ApiProperty({
    example: 'John',
    minLength: 2,
    description: 'User first name',
  })
  @IsString()
  @MinLength(2)
  public readonly firstName: string;

  @ApiProperty({
    example: 'Doe',
    minLength: 2,
    description: 'User last name',
  })
  @IsString()
  @MinLength(2)
  public readonly lastName: string;

  @ApiPropertyOptional({
    example: 'user',
    enum: ['user', 'admin', 'seller'],
    required: false,
    description: 'User role in the system',
  })
  @IsOptional()
  @IsString()
  public readonly role?: string;
}
