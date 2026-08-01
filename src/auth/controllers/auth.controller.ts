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
import { AuthResponseDto } from '../dtos/auth-response-dto';
import { LoginDto } from '../dtos/login-dto';
import { RegisterDto } from '../dtos/register-dto';
import { AuthService } from '../services/auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
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
  async login(@Body() loginDto: LoginDto) {
    const response = await this.authService.login(loginDto);
    const accessToken = new AuthResponseDto(response.access_token);

    return accessToken;
  }

  @Post('/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation error (invalid email, password or name too short)',
  })
  @ApiConflictResponse({ description: 'Email is already registered' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ApiServiceUnavailableResponse({
    description: 'The users service is unreachable',
  })
  @Public()
  @Throttle({ short: { limit: 3, ttl: 60_000 } })
  async register(@Body() registerDto: RegisterDto) {
    const response = await this.authService.register(registerDto);
    const userId = new AuthResponseDto(response.user_id);

    return userId;
  }
}
