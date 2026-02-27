// src/core/config/__tests__/env.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { getEnv, validateEnv } from '../env'

describe('Environment Configuration', () => {
  test('getEnv returns environment variable value', () => {
    process.env.TEST_VAR = 'test-value'
    expect(getEnv('TEST_VAR')).toBe('test-value')
    delete process.env.TEST_VAR
  })

  test('getEnv returns undefined for missing variable without default', () => {
    delete process.env.NONEXISTENT_VAR
    expect(getEnv('NONEXISTENT_VAR')).toBeUndefined()
  })

  test('getEnv returns default for missing variable', () => {
    delete process.env.MISSING_VAR
    expect(getEnv('MISSING_VAR', 'default')).toBe('default')
  })

  test('getEnv returns actual value when set, not default', () => {
    process.env.TEST_OVERRIDE = 'actual'
    expect(getEnv('TEST_OVERRIDE', 'default')).toBe('actual')
    delete process.env.TEST_OVERRIDE
  })

  test('validateEnv throws on missing LLM_API_KEY', () => {
    const originalKey = process.env.LLM_API_KEY
    const originalBaseUrl = process.env.LLM_BASE_URL
    delete process.env.LLM_API_KEY
    process.env.LLM_BASE_URL = 'https://example.com'

    expect(() => validateEnv()).toThrow('LLM_API_KEY')

    if (originalKey) process.env.LLM_API_KEY = originalKey
    if (originalBaseUrl) process.env.LLM_BASE_URL = originalBaseUrl
    else delete process.env.LLM_BASE_URL
  })

  test('validateEnv throws on missing LLM_BASE_URL', () => {
    const originalKey = process.env.LLM_API_KEY
    const originalBaseUrl = process.env.LLM_BASE_URL
    process.env.LLM_API_KEY = 'test-key'
    delete process.env.LLM_BASE_URL

    expect(() => validateEnv()).toThrow('LLM_BASE_URL')

    if (originalKey) process.env.LLM_API_KEY = originalKey
    if (originalBaseUrl) process.env.LLM_BASE_URL = originalBaseUrl
    else delete process.env.LLM_BASE_URL
  })

  test('validateEnv throws with all missing variables listed', () => {
    const originalKey = process.env.LLM_API_KEY
    const originalBaseUrl = process.env.LLM_BASE_URL
    delete process.env.LLM_API_KEY
    delete process.env.LLM_BASE_URL

    expect(() => validateEnv()).toThrow('LLM_API_KEY, LLM_BASE_URL')

    if (originalKey) process.env.LLM_API_KEY = originalKey
    if (originalBaseUrl) process.env.LLM_BASE_URL = originalBaseUrl
  })

  test('validateEnv does not throw when all required variables are set', () => {
    const originalKey = process.env.LLM_API_KEY
    const originalBaseUrl = process.env.LLM_BASE_URL
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_BASE_URL = 'https://example.com'

    expect(() => validateEnv()).not.toThrow()

    if (originalKey) process.env.LLM_API_KEY = originalKey
    else delete process.env.LLM_API_KEY
    if (originalBaseUrl) process.env.LLM_BASE_URL = originalBaseUrl
    else delete process.env.LLM_BASE_URL
  })
})

describe('Config Object', () => {
  // We need to re-import for each test to reset the lazy evaluation
  // Using dynamic imports to reset module state

  beforeEach(() => {
    // Clear module cache for env module
    delete (globalThis as Record<string, unknown>).__config_cache__
  })

  afterEach(() => {
    // Clean up env vars
    delete process.env.LLM_API_KEY
    delete process.env.LLM_BASE_URL
    delete process.env.PORT
    delete process.env.RAG_API_URL
  })

  test('config throws when required env vars are missing', async () => {
    // Clear module cache
    const modulePath = require.resolve('../env')
    delete require.cache[modulePath]

    delete process.env.LLM_API_KEY
    delete process.env.LLM_BASE_URL

    // Dynamic import to get fresh module
    const { config } = await import('../env')

    expect(() => config.llm).toThrow('Missing required environment variables')
  })

  test('config returns correct values when env vars are set', async () => {
    // Clear module cache
    const modulePath = require.resolve('../env')
    delete require.cache[modulePath]

    process.env.LLM_API_KEY = 'test-api-key'
    process.env.LLM_BASE_URL = 'https://api.example.com'
    process.env.PORT = '4000'
    process.env.RAG_API_URL = 'https://rag.example.com'

    const { config } = await import('../env')

    expect(config.llm.apiKey).toBe('test-api-key')
    expect(config.llm.baseUrl).toBe('https://api.example.com')
    expect(config.server.port).toBe(4000)
    expect(config.rag.apiUrl).toBe('https://rag.example.com')
  })

  test('config uses default values when optional vars are missing', async () => {
    // Clear module cache
    const modulePath = require.resolve('../env')
    delete require.cache[modulePath]

    process.env.LLM_API_KEY = 'test-api-key'
    process.env.LLM_BASE_URL = 'https://api.example.com'
    delete process.env.PORT
    delete process.env.RAG_API_URL

    const { config } = await import('../env')

    expect(config.server.port).toBe(3000)
    expect(config.rag.apiUrl).toBe('https://pipeline-api.felixtek.cloud')
  })

  test('config throws on invalid PORT (NaN)', async () => {
    // Clear module cache
    const modulePath = require.resolve('../env')
    delete require.cache[modulePath]

    process.env.LLM_API_KEY = 'test-api-key'
    process.env.LLM_BASE_URL = 'https://api.example.com'
    process.env.PORT = 'not-a-number'

    const { config } = await import('../env')

    expect(() => config.server).toThrow('Invalid PORT')
  })

  test('config throws on invalid PORT (negative)', async () => {
    // Clear module cache
    const modulePath = require.resolve('../env')
    delete require.cache[modulePath]

    process.env.LLM_API_KEY = 'test-api-key'
    process.env.LLM_BASE_URL = 'https://api.example.com'
    process.env.PORT = '-1'

    const { config } = await import('../env')

    expect(() => config.server).toThrow('Invalid PORT')
  })

  test('config throws on invalid PORT (too high)', async () => {
    // Clear module cache
    const modulePath = require.resolve('../env')
    delete require.cache[modulePath]

    process.env.LLM_API_KEY = 'test-api-key'
    process.env.LLM_BASE_URL = 'https://api.example.com'
    process.env.PORT = '70000'

    const { config } = await import('../env')

    expect(() => config.server).toThrow('Invalid PORT')
  })

  test('config throws on invalid PORT (non-integer)', async () => {
    // Clear module cache
    const modulePath = require.resolve('../env')
    delete require.cache[modulePath]

    process.env.LLM_API_KEY = 'test-api-key'
    process.env.LLM_BASE_URL = 'https://api.example.com'
    process.env.PORT = '3000.5'

    const { config } = await import('../env')

    expect(() => config.server).toThrow('Invalid PORT')
  })
})
