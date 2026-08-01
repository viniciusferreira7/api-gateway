import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PinoLoggerService } from '@viniciusferreira7/signals/nest';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvService } from './env/env.service';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

async function bootstrap() {
  // `bufferLogs` holds back everything Nest emits while the container is
  // starting, so those messages are replayed through the logger set below
  // instead of being printed in the default format.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLoggerService));

  app.setGlobalPrefix('api');

  const envService = app.get(EnvService);

  const port = envService.get('PORT');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "'data:'", "'https:'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedOrigins = envService.get('CORS_ORIGIN')?.split(',') || ['*'];

      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Marketplace API Gateway')
    .setDescription(
      `
          API Gateway for the Marketplace system with microservices

          Available Services:
          - Users Service: Authentication and user management
          - Products Service: Product catalog and management
          - Checkout Service: Cart and order processing
          - Payments Service: Payment processing

          Authentication:
          - Use JWT Bearer token for protected routes
          - Use Session token for session validation
      `
    )
    .setVersion('1.0')
    .setContact(
      'Marketplace Team',
      '<https://marketplace.com>',
      'dev@marketplace.com'
    )
    .setLicense('MIT', '<https://opensource.org/licenses/MIT>')
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
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {},
    customSiteTitle: 'Marketplace API Gateway Documentation',
    customfavIcon: './favicon',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
  });

  await app.listen(port);

  // Through the Nest logger rather than console.log, so these land in the
  // structured stream the collector scrapes like every other record.
  const logger = new Logger('Bootstrap');
  logger.log(`API Gateway running on port ${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
