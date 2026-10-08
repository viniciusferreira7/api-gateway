import { ApiProperty } from '@nestjs/swagger';

/**
 * Documents the body of `POST /cart/checkout` for Swagger only; the checkout
 * service validates it. Never use it as the type of `@Body()` (see
 * `CreateProductRequestDto`).
 */
export class CheckoutRequestDto {
  @ApiProperty({
    enum: ['credit_card', 'debit_card', 'pix', 'boleto'],
    example: 'pix',
  })
  paymentMethod: string;
}
