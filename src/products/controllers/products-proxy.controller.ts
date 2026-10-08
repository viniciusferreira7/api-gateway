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
  ApiForbiddenResponse,
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
import { CreateProductRequestDto } from '../dtos/create-product-request.dto';

/**
 * Forwards the products-service routes one at a time, so nothing it adds later
 * becomes reachable through the gateway by accident.
 *
 * The reads are a public catalog there, so they are public here too and carry
 * no token downstream. Static and prefixed routes come before `:id`: Express
 * matches in declaration order.
 */
@ApiTags('Products')
@ApiServiceUnavailableResponse({
  description: 'The products service is unreachable',
})
@Controller('products')
export class ProductsProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get()
  @ApiOperation({ summary: 'List active products, newest first' })
  @ApiOkResponse({ description: 'The active products' })
  listActive() {
    return this.read('/products');
  }

  @Get('seller/:sellerId')
  @ApiOperation({ summary: "List a seller's active products" })
  @ApiOkResponse({ description: "The seller's active products" })
  @ApiBadRequestResponse({ description: 'The seller id is not a UUID' })
  listBySeller(@Param('sellerId', ParseUUIDPipe) sellerId: string) {
    return this.read(`/products/seller/${encodeURIComponent(sellerId)}`);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an active product by id' })
  @ApiOkResponse({ description: 'The product' })
  @ApiBadRequestResponse({ description: 'The id is not a UUID' })
  @ApiNotFoundResponse({ description: 'No active product has this id' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.read(`/products/${encodeURIComponent(id)}`);
  }

  @Post()
  @UseGuards(ValidateTokenGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a product (sellers only)' })
  @ApiBody({ type: CreateProductRequestDto })
  @ApiCreatedResponse({ description: 'The created product' })
  @ApiBadRequestResponse({ description: 'The body failed validation' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'The user is not a seller' })
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.proxyService.proxyRequest(
      'products',
      {
        method: 'POST',
        path: '/products',
        body,
        headers: { authorization: request.headers.authorization },
      },
      request.user
    );
  }

  private read(path: string) {
    return this.proxyService.proxyRequest('products', { method: 'GET', path });
  }
}
