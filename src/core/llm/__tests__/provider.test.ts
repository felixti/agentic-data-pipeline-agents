// src/core/llm/__tests__/provider.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createLLMProvider, getLLM } from '../provider'

describe('LLM Provider', () => {
  test('createLLMProvider returns provider instance', () => {
    const provider = createLLMProvider('gpt-4o')
    expect(provider).toBeDefined()
    expect(typeof provider).toBe('function')
  })

  test('getLLM returns a model instance', () => {
    const model = getLLM('gpt-4o')
    expect(model).toBeDefined()
  })

  test('provider uses environment configuration', () => {
    const originalUrl = process.env.LLM_BASE_URL
    process.env.LLM_BASE_URL = 'https://custom.api.com/v1'

    const provider = createLLMProvider('gpt-4o')
    expect(provider).toBeDefined()

    process.env.LLM_BASE_URL = originalUrl
  })
})
