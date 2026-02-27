// src/core/config/__tests__/env.test.ts
import { describe, test, expect } from 'bun:test'
import { getEnv, validateEnv } from '../env'

describe('Environment Configuration', () => {
  test('getEnv returns environment variable value', () => {
    process.env.TEST_VAR = 'test-value'
    expect(getEnv('TEST_VAR')).toBe('test-value')
    delete process.env.TEST_VAR
  })

  test('getEnv returns default for missing variable', () => {
    expect(getEnv('MISSING_VAR', 'default')).toBe('default')
  })

  test('validateEnv throws on missing required variables', () => {
    const originalKey = process.env.LLM_API_KEY
    delete process.env.LLM_API_KEY

    expect(() => validateEnv()).toThrow('LLM_API_KEY')

    if (originalKey) process.env.LLM_API_KEY = originalKey
  })
})
