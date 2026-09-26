import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserResponseDto } from '@/auth/dtos/user-response-dto';
import { ValidateTokenGuard } from '@/guards/validate-token.guard';
import type { AuthenticatedRequest } from '@/interfaces/authenticated-request';
import { ProxyService } from '@/proxy/services/proxy.service';

/**
 * Forwards the users-service reads one route at a time, so nothing the users
 * service adds later becomes reachable through the gateway by accident.
 *
 * Static routes come before `:id`: Express matches in declaration order.
 */
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiServiceUnavailableResponse({
  description: 'The users service is unreachable',
})
@UseGuards(ValidateTokenGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get the logged-in account' })
  @ApiOkResponse({ type: UserResponseDto })
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.forward('/users/profile', request);
  }

  @Get('sellers')
  @ApiOperation({ summary: 'List active sellers, without emails' })
  @ApiOkResponse({ description: 'Active sellers sorted by name' })
  listSellers(@Req() request: AuthenticatedRequest) {
    return this.forward('/users/sellers', request);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id, without email' })
  @ApiOkResponse({ description: 'The public user' })
  @ApiBadRequestResponse({ description: 'The id is not a UUID' })
  @ApiNotFoundResponse({ description: 'No user has this id' })
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.forward(`/users/${encodeURIComponent(id)}`, request);
  }

  private forward(path: string, request: AuthenticatedRequest) {
    return this.proxyService.proxyRequest(
      'users',
      {
        method: 'GET',
        path,
        headers: { authorization: request.headers.authorization },
      },
      request.user
    );
  }
}
