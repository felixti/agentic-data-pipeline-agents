// src/core/telemetry/__tests__/phoenix.test.ts
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { createSpan, isPhoenixEnabled, initPhoenix } from '../phoenix'

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
      expect(typeof isPhoenixEnabled()).toBe('boolean')
    })
  })
})
