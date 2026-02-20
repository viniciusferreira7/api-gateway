# API Gateway

> ⚠️ **Work In Progress** - This project is currently under active development.

Central entry point for the Marketplace microservices architecture. Routes HTTP requests to downstream gRPC services, handling cross-cutting concerns like authentication, rate limiting, CORS, and request validation.

## Architecture

```
Client
  │
  ▼
API Gateway (REST/HTTP)
  │
  ├── GatewayService   → resolves downstream service URLs and timeouts
  ├── GrpcModule       → builds gRPC ClientOptions per service
  └── ProxyService     → forwards requests to the correct microservice
        │
        ├── users-service    (gRPC)
        ├── products-service (gRPC)
        ├── checkout-service (gRPC)
        └── payments-service (gRPC)
```

## Project Structure

```
src/
├── env/            # Environment validation (Zod schema)
├── gateway/        # Service URL and timeout configuration
├── grpc/           # gRPC client factory (ClientOptions builder)
├── proxy/          # Request forwarding to downstream services
├── app.module.ts
└── main.ts
```

## Environment Variables

| Variable              | Description                                     | Required |
|-----------------------|-------------------------------------------------|----------|
| `PORT`                | HTTP port (default: `3333`)                     | No       |
| `NODE_ENV`            | `dev` \| `test` \| `production` (default: `dev`) | No       |
| `JWT_SECRET`          | Secret for JWT verification                     | Yes      |
| `USERS_SERVICE_URL`   | gRPC URL for the users service                  | Yes      |
| `PRODUCTS_SERVICE_URL`| gRPC URL for the products service               | Yes      |
| `CHECKOUT_SERVICE_URL`| gRPC URL for the checkout service               | Yes      |
| `PAYMENTS_SERVICE_URL`| gRPC URL for the payments service               | Yes      |
| `CORS_ORIGIN`         | `*` or comma-separated list of allowed origins  | Yes      |

## Running

```bash
# development
pnpm start:dev

# production
pnpm build
pnpm start:prod
```

## API Docs

Swagger UI is available at `http://localhost:<PORT>/api` when the server is running.

## Scripts

| Script           | Description                        |
|------------------|------------------------------------|
| `pnpm start:dev` | Start in watch mode                |
| `pnpm build`     | Compile to `dist/`                 |
| `pnpm lint`      | Lint with Biome                    |
| `pnpm check:fix` | Format and lint with Biome         |
| `pnpm check:type`| Type-check with TypeScript         |
| `pnpm test:cov`  | Run tests with coverage            |
