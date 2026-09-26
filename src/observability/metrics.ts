import { defineMetrics } from '@viniciusferreira7/signals';

export const metrics = defineMetrics(
  {
    auth_operations: {
      kind: 'counter',
      description:
        'Authentication operations, by operation and how they settled',
    },
    auth_operation_duration: {
      kind: 'histogram',
      description: 'Time spent on one authentication operation',
      unit: 'ms',
    },
    upstream_requests: {
      kind: 'counter',
      description: 'Calls to downstream services, by service and outcome',
    },
    upstream_request_duration: {
      kind: 'histogram',
      description: 'Downstream call latency, retries and breaker wait included',
      unit: 'ms',
    },
    upstream_retries: {
      kind: 'counter',
      description: 'Downstream attempts retried after a retryable failure',
    },
    circuit_breaker_transitions: {
      kind: 'counter',
      description: 'Circuit breaker state changes, by service and new state',
    },
  },
  'api-gateway'
);
