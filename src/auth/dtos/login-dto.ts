import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email of user' })
  @IsEmail()
  public readonly email: string;

  @ApiProperty({
    example: '123456',
    minLength: 6,
    description: 'Password of user',
  })
  @IsString()
  @MinLength(6)
  public readonly password: string;
}
