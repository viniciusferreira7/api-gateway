import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../decorators/public.decorator';
import { LoginDto } from '../dtos/login-dto';
import { LoginResponseDto } from '../dtos/login-response-dto';
import { RegisterDto } from '../dtos/register-dto';
import { UserResponseDto } from '../dtos/user-response-dto';
import { AuthService } from '../services/auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation error (invalid email or password too short)',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ApiServiceUnavailableResponse({
    description: 'The users service is unreachable',
  })
  @Public()
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation error (invalid email, password, name or role)',
  })
  @ApiConflictResponse({ description: 'Email is already registered' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ApiServiceUnavailableResponse({
    description: 'The users service is unreachable',
  })
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  async register(@Body() registerDto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(registerDto);
  }
}
