import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

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

  @ApiProperty({
    example: UserRole.BUYER,
    enum: UserRole,
    description: 'User role in the system',
  })
  @IsEnum(UserRole)
  public readonly role: UserRole;
}
