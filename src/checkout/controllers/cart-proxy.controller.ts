import {
  Body,
  Controller,
  Delete,
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
  ApiConflictResponse,
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
import { AddCartItemRequestDto } from '../dtos/add-cart-item-request.dto';

/**
 * Forwards the cart routes of the checkout service one at a time. The cart
 * always belongs to the user in the token; the checkout reads it from there.
 */
@ApiTags('Checkout')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiServiceUnavailableResponse({
  description: 'The checkout service is unreachable',
})
@UseGuards(ValidateTokenGuard)
@Controller('cart')
export class CartProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get()
  @ApiOperation({ summary: "Get the user's active cart" })
  @ApiOkResponse({ description: 'The active cart, empty when there is none' })
  getCart(@Req() request: AuthenticatedRequest) {
    return this.forward('GET', '/cart', request);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a product to the cart' })
  @ApiBody({ type: AddCartItemRequestDto })
  @ApiCreatedResponse({ description: 'The updated cart' })
  @ApiBadRequestResponse({ description: 'The body failed validation' })
  @ApiNotFoundResponse({ description: 'The product does not exist' })
  @ApiConflictResponse({
    description: 'Not enough stock, or the cart total exceeds the maximum',
  })
  addItem(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.forward('POST', '/cart/items', request, body);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove an item from the cart' })
  @ApiOkResponse({ description: 'The updated cart' })
  @ApiBadRequestResponse({ description: 'The item id is not a UUID' })
  @ApiNotFoundResponse({ description: "The item is not in the user's cart" })
  removeItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.forward(
      'DELETE',
      `/cart/items/${encodeURIComponent(itemId)}`,
      request
    );
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
