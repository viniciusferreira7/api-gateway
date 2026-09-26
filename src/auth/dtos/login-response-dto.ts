import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response-dto';

export class LoginResponseDto {
  @ApiProperty({ type: UserResponseDto })
  public readonly user: UserResponseDto;

  @ApiProperty({ description: 'HS256 JWT valid for 24 hours' })
  public readonly token: string;
}
