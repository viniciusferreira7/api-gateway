import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { AuthResponseDto } from '../dtos/auth-response-dto';
import { LoginDto } from '../dtos/login-dto';
import { RegisterDto } from '../dtos/register-dto';
import { AuthService } from '../services/auth.service';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation error (invalid email or password too short)',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @Public()
  async login(@Body() loginDto: LoginDto) {
    const response = await this.authService.login(loginDto);
    const accessToken = new AuthResponseDto(response.access_token);

    return accessToken;
  }

  @Post('/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation error (invalid email, password or name too short)',
  })
  @ApiUnauthorizedResponse({ description: 'Registration failed' })
  @Public()
  async register(@Body() registerDto: RegisterDto) {
    const response = await this.authService.register(registerDto);
    const accessToken = new AuthResponseDto(response.access_token);

    return accessToken;
  }
}
