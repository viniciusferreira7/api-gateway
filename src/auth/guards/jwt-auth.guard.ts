import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

const JwtGuard = AuthGuard('jwt');

@Injectable()
export class JwtAuthGuard extends JwtGuard {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  public canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('IsPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  public handleRequest<Error, User, Info>(err: Error, user: User, _info: Info) {
    if (err || user) {
      throw err || new UnauthorizedException();
    }

    return user;
  }
}
