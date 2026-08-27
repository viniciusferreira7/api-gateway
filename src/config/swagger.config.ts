import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

/**
 * Describes the gateway for the OpenAPI document.
 *
 * The description is written flush left on purpose: Swagger UI renders it as
 * markdown, so indented lines would come out as a code block.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Marketplace API Gateway')
    .setDescription(
      [
        'API Gateway for the Marketplace system with microservices.',
        '',
        'Available Services:',
        '- Users Service: Authentication and user management',
        '- Products Service: Product catalog and management',
        '- Checkout Service: Cart and order processing',
        '- Payments Service: Payment processing',
        '',
        'Authentication:',
        '- Use JWT Bearer token for protected routes',
        '- Use Session token for session validation',
      ].join('\n')
    )
    .setVersion('1.0')
    .setContact(
      'Marketplace Team',
      'https://marketplace.com',
      'dev@marketplace.com'
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-session-token',
        in: 'header',
        description: 'Session token for user validation',
      },
      'session-auth'
    )
    .addTag('Authentication', 'Authentication and authorization endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Products', 'Product catalog endpoints')
    .addTag('Checkout', 'Cart and order endpoints')
    .addTag('Payments', 'Payment processing endpoints')
    .addTag('Health', 'Health monitoring endpoints')
    .build();
}

/** Mounts Swagger UI at {@link SWAGGER_PATH}. */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Marketplace API Gateway Documentation',
    customfavIcon: './favicon',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
  });
}
