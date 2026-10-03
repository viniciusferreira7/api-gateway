import { Injectable } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerRequest,
} from '@nestjs/throttler';

/**
 * Clients are tracked by `req.ip` alone (ThrottlerGuard's default tracker).
 * Nothing the client sends — User-Agent, X-Forwarded-For — is part of the
 * key, so a header change never buys a fresh counter. `trust proxy` is off,
 * so `req.ip` is the socket peer; enable it only for a known proxy.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest({
    context,
    limit,
    ttl,
    blockDuration,
    throttler,
    generateKey,
  }: ThrottlerRequest): Promise<boolean> {
    const { req, res } = this.getRequestResponse(context);

    // canActivate calls this once per named throttler (short, medium, long).
    // Each needs its own counter: a shared name made every request count
    // three times against whichever limit was smallest.
    const throttlerName = throttler.name ?? 'default';

    const tracker = await this.getTracker(req);
    const key = generateKey(context, tracker, throttlerName);

    const { totalHits } = await this.storageService.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttlerName
    );

    if (totalHits > limit) {
      res.setHeader('Retry-After', Math.round(ttl / 1000));
      throw new ThrottlerException();
    }

    res.setHeader(`${this.headerPrefix}-Limit`, limit);
    res.setHeader(`${this.headerPrefix}-Remaining`, limit - totalHits);
    res.setHeader(`${this.headerPrefix}-Reset`, Math.round(ttl / 1000));

    return true;
  }
}
