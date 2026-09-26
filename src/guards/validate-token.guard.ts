import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '@/auth/services/auth.service';

/** One non-empty token after the scheme; anything else never leaves the gateway. */
const BEARER = /^Bearer [^\s]+$/;

/**
 * Authenticates a request by asking the users service about its bearer token.
 *
 * Failures from the users service are propagated as they are: a refused token
 * is 401, an outage stays 503 so clients retry instead of logging in again.
 */
@Injectable()
export class ValidateTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { authorization } = request.headers;

    if (typeof authorization !== 'string' || !BEARER.test(authorization)) {
      throw new UnauthorizedException();
    }

    const { userId, email, role } =
      await this.authService.validateToken(authorization);

    request.user = { id: userId, email, role };

    return true;
  }
}
