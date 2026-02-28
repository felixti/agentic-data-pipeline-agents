// tests/fixtures/errors.ts
export const errorFixtures = {
  llmTimeout: new Error('LLM request timeout after 30000ms'),
  llmRateLimit: new Error('Rate limit exceeded'),
  llmMalformed: '{ invalid json response',
  ragUnavailable: {
    ok: false as const,
    status: 503,
    statusText: 'Service Unavailable',
  },
  ragTimeout: {
    ok: false as const,
    status: 504,
    statusText: 'Gateway Timeout',
  },
}
