import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthResponseDto } from '@/dto/auth-response-dto';
import { LoginDto } from '@/dto/login-dto';
import { RegisterDto } from '@/dto/register-dto';
import { AuthService } from './auth.service';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error (invalid email or password too short)' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    const response = await this.authService.login(loginDto);
    const accessToken = new AuthResponseDto(response.access_token);

    return accessToken;
  }

  @Post('/register')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Validation error (invalid email, password or name too short)' })
  @ApiUnauthorizedResponse({ description: 'Registration failed' })
  async register(@Body() registerDto: RegisterDto) {
    const response = await this.authService.register(registerDto);
    const accessToken = new AuthResponseDto(response.access_token);

    return accessToken;
  }
}
