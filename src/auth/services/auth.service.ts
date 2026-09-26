import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  HttpClientService,
  HttpRequestError,
} from '@/http/services/http-client.service';
import type {
  UserSession,
  ValidateSessionResponse,
} from '@/interfaces/user-session';
import { metrics } from '@/observability/metrics';
import type { LoginDto } from '../dtos/login-dto';
import type { RegisterDto } from '../dtos/register-dto';

type AuthOperation = 'login' | 'register' | 'validate_session' | 'validate_jwt';

type AuthOutcome = 'succeeded' | 'rejected' | 'unavailable';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly httpClient: HttpClientService
  ) {}

  /**
   * Records how one authentication operation ended.
   *
   * `rejected` is the caller's fault — bad credentials, a duplicate email — and
   * `unavailable` is ours. Keeping them apart is what tells a brute force
   * attempt from a users service outage on the dashboard; a single `failed`
   * bucket would show the same spike for both.
   *
   * Attributes are a closed set. The email and the user id belong in the log
   * line, where the trace_id already correlates them.
   */
  private settle(
    operation: AuthOperation,
    outcome: AuthOutcome,
    startedAt: number
  ): void {
    metrics.auth_operations.add(1, { operation, outcome });
    metrics.auth_operation_duration.record(Date.now() - startedAt, {
      operation,
      outcome,
    });
  }

  private static outcomeOf(failure: HttpException): AuthOutcome {
    return failure.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR
      ? 'unavailable'
      : 'rejected';
  }

  /**
   * Translates a failed downstream call into the status the client should see.
   *
   * `HttpRequestError` carries the upstream status; collapsing everything into
   * 401 told a user their credentials were wrong whenever the users service was
   * merely down, and hid outages from anything alerting on 5xx.
   *
   * Anything that is not an `HttpRequestError` — a timeout, a socket error, an
   * open circuit breaker — never reached the service, so it is a 503.
   *
   * Messages stay generic on purpose: the downstream body may carry internal
   * detail and is never forwarded. The cause is logged instead, where the
   * trace_id correlates it to the request.
   */
  private upstreamFailure(error: unknown, operation: string): HttpException {
    if (!(error instanceof HttpRequestError)) {
      this.logger.error(
        `${operation} failed before reaching the users service: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );

      return new ServiceUnavailableException(
        'Authentication service is unavailable'
      );
    }

    this.logger.warn(
      `${operation} rejected by the users service with status ${error.status}`
    );

    switch (error.status) {
      // 404 is folded in with 401 deliberately: on a login attempt it means the
      // account does not exist, and answering differently would let an
      // unauthenticated caller enumerate registered emails.
      case HttpStatus.UNAUTHORIZED:
      case HttpStatus.FORBIDDEN:
      case HttpStatus.NOT_FOUND:
        return new UnauthorizedException('Invalid credentials');

      case HttpStatus.BAD_REQUEST:
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return new BadRequestException('Invalid request payload');

      case HttpStatus.CONFLICT:
        return new ConflictException('Email is already registered');

      case HttpStatus.TOO_MANY_REQUESTS:
        return new HttpException(
          'Too many requests, try again later',
          HttpStatus.TOO_MANY_REQUESTS
        );

      default:
        return new ServiceUnavailableException(
          'Authentication service is unavailable'
        );
    }
  }

  async validateJwtToken(token: string): Promise<unknown> {
    const startedAt = Date.now();

    try {
      const payload = this.jwtService.verify(token);

      this.settle('validate_jwt', 'succeeded', startedAt);

      return payload;
    } catch (_err) {
      this.settle('validate_jwt', 'rejected', startedAt);

      throw new UnauthorizedException('Invalid JWT token');
    }
  }

  async validateSessionToken(sessionToken: string): Promise<UserSession> {
    const startedAt = Date.now();

    try {
      const { valid, user } =
        await this.httpClient.request<ValidateSessionResponse>('users', {
          method: 'POST',
          path: '/auth/sessions/validate',
          body: { token: sessionToken },
        });

      const session: UserSession = {
        valid,
        user: user
          ? {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              role: user.role,
              status: user.status,
            }
          : null,
      };

      this.settle('validate_session', 'succeeded', startedAt);

      return session;
    } catch (err) {
      const failure = this.upstreamFailure(err, 'Session validation');

      this.settle(
        'validate_session',
        AuthService.outcomeOf(failure),
        startedAt
      );

      throw failure;
    }
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    const startedAt = Date.now();

    try {
      const session = await this.httpClient.request<{ access_token: string }>(
        'users',
        {
          method: 'POST',
          path: '/auth/login',
          body: {
            email: loginDto.email,
            password: loginDto.password,
          },
        }
      );

      this.settle('login', 'succeeded', startedAt);

      return session;
    } catch (err) {
      const failure = this.upstreamFailure(err, 'Login');

      this.settle('login', AuthService.outcomeOf(failure), startedAt);

      throw failure;
    }
  }

  async register(registerDto: RegisterDto): Promise<{ user_id: string }> {
    const startedAt = Date.now();

    try {
      const created = await this.httpClient.request<{ user_id: string }>(
        'users',
        {
          method: 'POST',
          path: '/auth/register',
          body: {
            email: registerDto.email,
            password: registerDto.password,
            first_name: registerDto.firstName,
            last_name: registerDto.lastName,
          },
        }
      );

      this.settle('register', 'succeeded', startedAt);

      return created;
    } catch (err) {
      const failure = this.upstreamFailure(err, 'Registration');

      this.settle('register', AuthService.outcomeOf(failure), startedAt);

      throw failure;
    }
  }
}
