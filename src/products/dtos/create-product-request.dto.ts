import { ApiProperty } from '@nestjs/swagger';

/**
 * Documents the body of `POST /products` for Swagger only. The gateway never
 * validates it: the products service owns the rules and answers 400. Never use
 * it as the type of `@Body()` — the global ValidationPipe, with `whitelist`,
 * would strip every property of a class without validators.
 */
export class CreateProductRequestDto {
  @ApiProperty({ example: 'Mechanical keyboard', maxLength: 255 })
  name: string;

  @ApiProperty({ example: 'Hot-swappable, 75% layout' })
  description: string;

  @ApiProperty({
    example: 349.9,
    minimum: 0.01,
    maximum: 99999999.99,
    description: 'At most 2 decimal places',
  })
  price: number;

  @ApiProperty({ example: 10, minimum: 0 })
  stock: number;
}
