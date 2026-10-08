/**
 * A thin client for the running gateway. Every call waits a little first, so
 * a full run stays under the gateway's `short` throttle (10 requests/s per IP).
 */
export const GATEWAY_URL = (
  process.env.GATEWAY_URL ?? 'http://localhost:3333/api'
).replace(/\/$/, '');

const PAUSE_MS = 150;
const PAYMENT_POLL_MS = 500;
const PAYMENT_TIMEOUT_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface Reply {
  status: number;
  // biome-ignore lint/suspicious/noExplicitAny: response bodies are asserted field by field
  body: any;
}

export async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {}
): Promise<Reply> {
  await sleep(PAUSE_MS);

  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();

  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

/** Fails fast, naming what to start, instead of letting every step fail. */
export async function assertMarketplaceUp(): Promise<void> {
  let reply: Reply;

  try {
    reply = await call('GET', '/healthz');
  } catch {
    throw new Error(
      `Gateway is not reachable at ${GATEWAY_URL} — start the api-gateway`
    );
  }

  if (reply.status !== 200) {
    const down = Object.entries(reply.body?.services ?? {})
      .filter(([, status]) => status !== 'healthy')
      .map(([name]) => name);

    throw new Error(
      `Marketplace is not up: ${down.join(', ') || `healthz answered ${reply.status}`} unhealthy`
    );
  }
}

/** Polls until the payment leaves 404/pending, or fails with the last status. */
export async function waitForPayment(orderId: string, token: string) {
  const deadline = Date.now() + PAYMENT_TIMEOUT_MS;
  let last: Reply | undefined;

  while (Date.now() < deadline) {
    last = await call('GET', `/payments/${orderId}`, { token });

    if (last.status === 200 && last.body.status !== 'pending') {
      return last.body;
    }

    await sleep(PAYMENT_POLL_MS);
  }

  throw new Error(
    `Payment for order ${orderId} not settled after ${PAYMENT_TIMEOUT_MS} ms (last: ${last?.status} ${JSON.stringify(last?.body)})`
  );
}
