import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpRequestError } from '@/http/services/http-client.service';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let json: ReturnType<typeof vi.fn>;
  let status: ReturnType<typeof vi.fn>;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    // The filter logs through the Nest logger; silenced to keep the run quiet.
    vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
    vi.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);

    json = vi.fn();
    status = vi.fn().mockReturnValue({ json });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'POST', originalUrl: '/api/auth/login' }),
      }),
    } as unknown as ArgumentsHost;
  });

  const bodySent = () => json.mock.calls[0][0];

  it('keeps the same envelope for any error', () => {
    filter.catch(new NotFoundException('nope'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(bodySent()).toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
      path: '/api/auth/login',
      message: 'nope',
    });
    expect(Date.parse(bodySent().timestamp)).not.toBeNaN();
  });

  it('preserves the message list produced by the ValidationPipe', () => {
    filter.catch(new BadRequestException(['email must be an email']), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(bodySent().message).toEqual(['email must be an email']);
  });

  it('turns an unknown error into a generic 500', () => {
    filter.catch(new Error('psql: relation "users" does not exist'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(bodySent().message).toBe('Internal server error');
  });

  it('does not let the message of a 5xx HttpException escape', () => {
    filter.catch(new HttpException('connection string is invalid', 500), host);

    expect(bodySent().message).toBe('Internal server error');
  });

  // A 503 has to stay readable as "try again", otherwise the client cannot
  // tell a temporary outage from a terminal failure.
  it('answers a 5xx with the canonical status phrase, not its message', () => {
    filter.catch(
      new ServiceUnavailableException('users pool exhausted at 10.0.0.4'),
      host
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(bodySent().message).toBe('Service unavailable');
  });

  describe('HttpRequestError', () => {
    it('keeps a downstream 4xx status without forwarding its message', () => {
      filter.catch(
        new HttpRequestError(409, 'duplicate key on users.email'),
        host
      );

      expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(bodySent().message).toBe('Upstream service request failed');
    });

    // A downstream 5xx is a gateway failure, not an internal error of ours.
    it('translates a downstream 5xx into a 502', () => {
      filter.catch(new HttpRequestError(503, 'users service down'), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
      expect(bodySent().message).toBe('Upstream service request failed');
    });
  });
});
