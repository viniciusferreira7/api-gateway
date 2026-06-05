# API Gateway

> ⚠️ **Work In Progress** - This project is currently under active development.

Central entry point for the Marketplace microservices architecture. Routes HTTP requests to downstream gRPC services, handling cross-cutting concerns like authentication, authorization, rate limiting, CORS, request validation, and resilience (circuit breaking).

Built with [NestJS](https://nestjs.com/) 11, gRPC, and Zod-validated configuration.

## Features

- **Authentication** — JWT Bearer auth (Passport `passport-jwt`) and session-token validation against the users service.
- **Authorization** — role-based access via a `@Roles()` decorator + `RoleGuard`; opt-out of auth with `@Public()`.
- **Rate limiting** — three configurable tiers (`short` / `medium` / `long`) via `@nestjs/throttler`, applied globally.
- **Resilience** — per-service circuit breakers (`opossum`) with timeout, error-threshold, and reset handling.
- **Security hardening** — `helmet` (CSP, HSTS), strict CORS allowlist with credentials, and a global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`).
- **Observability** — request logging middleware applied to all routes.
- **Config validation** — all environment variables validated at startup with a Zod schema; the app fails fast on misconfiguration.
- **API docs** — Swagger/OpenAPI with Bearer and session-token security schemes.

## Architecture

```
Client
  │
  ▼
API Gateway (REST/HTTP, global prefix /api)
  │
  ├── Middleware       → LoggingMiddleware (all routes)
  ├── Guards           → JwtAuthGuard · SessionGuard · RoleGuard · CustomThrottlerGuard
  ├── AuthModule       → login / register, JWT issuing, session validation
  │
  ├── GatewayService          → resolves downstream service URLs and timeouts
  ├── GrpcService / Factory   → builds, creates and caches gRPC clients (business + health)
  ├── CircuitBreakerService   → wraps gRPC calls with per-service circuit breakers
  └── ProxyService            → forwards requests to the correct microservice
        │                       JWT and x-* headers forwarded as gRPC metadata
        ├── users-service     (gRPC)
        ├── products-service  (gRPC)
        ├── checkouts-service (gRPC)
        └── payments-service  (gRPC)
```

## Project Structure

```
src/
├── auth/           # Authentication: controller, service, JWT strategy
│   ├── controllers/
│   ├── decorators/ # @Public, @Roles, @CurrentUser
│   ├── dtos/
│   ├── services/
│   └── strategies/ # jwt.strategy
├── env/            # Environment validation (Zod schema) + EnvService
├── gateway/        # Service URL and timeout configuration
├── grpc/           # gRPC client factory, ClientOptions builder, circuit breaker
│   ├── factories/
│   └── services/   # grpc.service, circuit-breaker.service
├── guards/         # jwt-auth, session, role, throttler guards
├── interfaces/     # Shared TS types (gRPC contracts, user session)
├── middleware/     # Logging middleware
├── proxy/          # Request forwarding and health check
├── app.module.ts
└── main.ts
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. All variables are validated at startup.

| Variable               | Description                                       | Required |
|------------------------|---------------------------------------------------|----------|
| `PORT`                 | HTTP port (default: `3333`)                       | No       |
| `NODE_ENV`             | `dev` \| `test` \| `production` (default: `dev`)  | No       |
| `JWT_SECRET`           | Secret for JWT signing/verification               | Yes      |
| `USERS_SERVICE_URL`    | gRPC URL for the users service                    | Yes      |
| `PRODUCTS_SERVICE_URL` | gRPC URL for the products service                 | Yes      |
| `CHECKOUT_SERVICE_URL` | gRPC URL for the checkout service                 | Yes      |
| `PAYMENTS_SERVICE_URL` | gRPC URL for the payments service                 | Yes      |
| `CORS_ORIGIN`          | `*` or comma-separated list of allowed origins    | Yes      |
| `RATE_TTL_SHORT`       | Window (ms) for the `short` rate-limit tier       | Yes      |
| `RATE_LIMIT_SHORT`     | Max requests per window for the `short` tier      | Yes      |
| `RATE_TTL_MEDIUM`      | Window (ms) for the `medium` rate-limit tier      | Yes      |
| `RATE_LIMIT_MEDIUM`    | Max requests per window for the `medium` tier     | Yes      |
| `RATE_TTL_LONG`        | Window (ms) for the `long` rate-limit tier        | Yes      |
| `RATE_LIMIT_LONG`      | Max requests per window for the `long` tier       | Yes      |

> Numeric values accept `_` separators (e.g. `60_000`).

## Running

```bash
# install dependencies
pnpm install

# development (watch mode)
pnpm start:dev

# production
pnpm build
pnpm start:prod
```

The gateway listens on `PORT` and exposes all routes under the `/api` prefix.

## API Docs

Swagger UI is available at `http://localhost:<PORT>/api/docs` when the server is running.

Two security schemes are configured:
- **JWT-auth** — `Authorization: Bearer <token>` for protected routes.
- **session-auth** — `x-session-token` header for session validation.

### Authentication endpoints

| Method | Route                | Description                          | Rate limit       |
|--------|----------------------|--------------------------------------|------------------|
| `POST` | `/api/auth/login`    | Authenticate and receive a JWT       | 5 / 60s          |
| `POST` | `/api/auth/register` | Create a user, returns the user id   | 3 / 60s          |

## Scripts

| Script             | Description                          |
|--------------------|--------------------------------------|
| `pnpm start`       | Start the server                     |
| `pnpm start:dev`   | Start in watch mode                  |
| `pnpm start:debug` | Start in watch + debug mode          |
| `pnpm build`       | Compile to `dist/`                   |
| `pnpm lint`        | Lint and fix with Biome              |
| `pnpm check`       | Check formatting and lint with Biome |
| `pnpm check:fix`   | Format and lint-fix with Biome       |
| `pnpm check:type`  | Type-check with TypeScript           |
| `pnpm format`      | Format with Prettier                 |
| `pnpm test:watch`  | Run tests in watch mode              |
| `pnpm test:cov`    | Run tests with coverage              |
| `pnpm test:e2e`    | Run end-to-end tests                 |
