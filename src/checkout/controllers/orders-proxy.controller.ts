import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ValidateTokenGuard } from '@/guards/validate-token.guard';
import type { HttpMethod } from '@/http/services/http-client.service';
import type { AuthenticatedRequest } from '@/interfaces/authenticated-request';
import { ProxyService } from '@/proxy/services/proxy.service';
import { CheckoutRequestDto } from '../dtos/checkout-request.dto';

/**
 * Forwards checkout and the order reads of the checkout service. Checkout is
 * never retried by the HTTP client (it is a POST), so one click places at
 * most one order.
 */
@ApiTags('Checkout')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiServiceUnavailableResponse({
  description: 'The checkout service is unreachable',
})
@UseGuards(ValidateTokenGuard)
@Controller()
export class OrdersProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post('cart/checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Turn the active cart into a pending order' })
  @ApiBody({ type: CheckoutRequestDto })
  @ApiCreatedResponse({ description: 'The pending order' })
  @ApiBadRequestResponse({
    description: 'Invalid payment method, or the cart is empty',
  })
  checkout(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.forward('POST', '/cart/checkout', request, body);
  }

  @Get('orders')
  @ApiOperation({ summary: "List the user's orders, newest first" })
  @ApiOkResponse({ description: "The user's orders" })
  listOrders(@Req() request: AuthenticatedRequest) {
    return this.forward('GET', '/orders', request);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: "Get one of the user's orders" })
  @ApiOkResponse({ description: 'The order with its items' })
  @ApiBadRequestResponse({ description: 'The id is not a UUID' })
  @ApiNotFoundResponse({ description: "No order of the user's has this id" })
  getOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.forward('GET', `/orders/${encodeURIComponent(id)}`, request);
  }

  private forward(
    method: HttpMethod,
    path: string,
    request: AuthenticatedRequest,
    body?: unknown
  ) {
    return this.proxyService.proxyRequest(
      'checkouts',
      {
        method,
        path,
        ...(body === undefined ? {} : { body }),
        headers: { authorization: request.headers.authorization },
      },
      request.user
    );
  }
}
