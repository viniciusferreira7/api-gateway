import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

/** The user as the users-service returns it; never carries the password. */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  public readonly id: string;

  @ApiProperty({ example: 'ana@marketplace.dev' })
  public readonly email: string;

  @ApiProperty({ example: 'Ana' })
  public readonly firstName: string;

  @ApiProperty({ example: 'Souza' })
  public readonly lastName: string;

  @ApiProperty({ enum: UserRole })
  public readonly role: UserRole;

  @ApiProperty({ enum: ['active', 'inactive'] })
  public readonly status: string;

  @ApiProperty({ format: 'date-time' })
  public readonly createdAt: string;

  @ApiProperty({ format: 'date-time' })
  public readonly updatedAt: string;
}
