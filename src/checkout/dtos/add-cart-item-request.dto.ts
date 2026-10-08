import { ApiProperty } from '@nestjs/swagger';

/**
 * Documents the body of `POST /cart/items` for Swagger only; the checkout
 * service validates it. Never use it as the type of `@Body()` (see
 * `CreateProductRequestDto`).
 */
export class AddCartItemRequestDto {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 99 })
  quantity: number;
}
