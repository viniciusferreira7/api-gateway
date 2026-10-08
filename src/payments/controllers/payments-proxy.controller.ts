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
import { ValidateTokenGuard } from '@/guards/validate-token.guard';
import type { AuthenticatedRequest } from '@/interfaces/authenticated-request';
import { ProxyService } from '@/proxy/services/proxy.service';

/** Forwards the payment lookup; the payments service checks ownership. */
@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiServiceUnavailableResponse({
  description: 'The payments service is unreachable',
})
@UseGuards(ValidateTokenGuard)
@Controller('payments')
export class PaymentsProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get(':orderId')
  @ApiOperation({
    summary: "Get the payment of one of the user's orders",
    description:
      '404 until the payment order is consumed, then pending, then approved or rejected.',
  })
  @ApiOkResponse({ description: 'The payment' })
  @ApiBadRequestResponse({ description: 'The order id is not a UUID' })
  @ApiNotFoundResponse({
    description: "No payment of the user's has this order id",
  })
  getPayment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.proxyService.proxyRequest(
      'payments',
      {
        method: 'GET',
        path: `/payments/${encodeURIComponent(orderId)}`,
        headers: { authorization: request.headers.authorization },
      },
      request.user
    );
  }
}
