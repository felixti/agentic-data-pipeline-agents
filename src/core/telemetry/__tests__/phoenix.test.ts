// src/core/telemetry/__tests__/phoenix.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createSpan, isPhoenixEnabled, initPhoenix, withSessionContext, createSessionSpan } from '../phoenix'

// Mock the config module
const originalEnv = process.env

describe('Phoenix Telemetry', () => {
  beforeEach(() => {
    // Reset module state between tests
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('createSpan', () => {
    test('executes function and returns result when Phoenix disabled', async () => {
      const result = await createSpan('test-span', {}, async () => {
        return 'test-result'
      })
      expect(result).toBe('test-result')
    })

    test('passes null span when Phoenix disabled', async () => {
      let receivedSpan: unknown = 'not-null'
      await createSpan('test-span', {}, async (span) => {
        receivedSpan = span
        return 'done'
      })
      expect(receivedSpan).toBeNull()
    })

    test('propagates errors from wrapped function', async () => {
      expect(async () => {
        await createSpan('test-span', {}, async () => {
          throw new Error('test error')
        })
      }).toThrow('test error')
    })

    test('executes async operations correctly', async () => {
      const start = Date.now()
      await createSpan('test-span', {}, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'done'
      })
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(10)
    })
  })

  describe('isPhoenixEnabled', () => {
    test('returns false before initialization', () => {
      // Phoenix starts disabled
      expect(isPhoenixEnabled()).toBe(false)
    })
  })

  describe('initPhoenix', () => {
    test('keeps Phoenix disabled when endpoint is not configured', () => {
      // Ensure no Phoenix endpoint is configured
      delete process.env.PHOENIX_ENDPOINT
      delete process.env.PHOENIX_API_KEY

      // Re-import config to pick up the env changes
      // Note: This test relies on config.telemetry.phoenixEndpoint being undefined

      initPhoenix()

      // Phoenix should remain disabled since no endpoint was configured
      expect(isPhoenixEnabled()).toBe(false)
    })
  })

  describe('withSessionContext', () => {
    test('executes function when Phoenix disabled', async () => {
      const result = await withSessionContext('test-session', async () => {
        return 'success'
      })
      expect(result).toBe('success')
    })

    test('passes through return value', async () => {
      const result = await withSessionContext('session-123', async () => {
        return { data: 'test' }
      })
      expect(result).toEqual({ data: 'test' })
    })

    test('propagates errors from wrapped function', async () => {
      expect(async () => {
        await withSessionContext('test-session', async () => {
          throw new Error('session error')
        })
      }).toThrow('session error')
    })
  })

  describe('createSessionSpan', () => {
    test('executes function when Phoenix disabled', async () => {
      const result = await createSessionSpan('test-span', {}, async () => {
        return 'test-result'
      })
      expect(result).toBe('test-result')
    })

    test('passes null span when Phoenix disabled', async () => {
      let receivedSpan: unknown = 'not-null'
      await createSessionSpan('test-span', {}, async (span) => {
        receivedSpan = span
        return 'done'
      })
      expect(receivedSpan).toBeNull()
    })

    test('propagates errors from wrapped function', async () => {
      expect(async () => {
        await createSessionSpan('test-span', {}, async () => {
          throw new Error('span error')
        })
      }).toThrow('span error')
    })
  })
})
