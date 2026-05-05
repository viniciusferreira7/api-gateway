import { Injectable } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerRequest,
} from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return `${req.ip}-${req.headers['user-agent']}`;
  }

  protected async handleRequest({
    context,
    limit,
    ttl,
    blockDuration,
    generateKey,
  }: ThrottlerRequest): Promise<boolean> {
    const { req, res } = this.getRequestResponse(context);

    const throttlerName = 'throttler';

    const tracker = await this.getTracker(req);
    const key = generateKey(context, tracker, throttlerName);

    const totalHits = await this.storageService.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttlerName
    );

    if (Number(totalHits) > limit) {
      res.setHeader('Retry-After', Math.round(ttl / 1000));
      throw new ThrottlerException();
    }

    res.setHeader(`${this.headerPrefix}-Limit`, limit);
    res.setHeader(`${this.headerPrefix}-Remaining`, limit - Number(totalHits));
    res.setHeader(`${this.headerPrefix}-Reset`, Math.round(ttl / 1000));

    return true;
  }
}
