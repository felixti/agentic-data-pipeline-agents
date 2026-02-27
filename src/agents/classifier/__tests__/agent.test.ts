// src/agents/classifier/__tests__/agent.test.ts
import { describe, test, expect } from 'bun:test'
import { classifyQuery } from '../index'

describe('Classifier Agent', () => {
  test('classifyQuery returns query type and confidence', async () => {
    const result = await classifyQuery('What is machine learning?')
    expect(result.queryType).toBeDefined()
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  test('classifyQuery identifies factual queries', async () => {
    const result = await classifyQuery('What is the capital of France?')
    expect(['factual', 'vague']).toContain(result.queryType)
  })
})
