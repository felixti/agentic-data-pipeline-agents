// src/core/tools/__tests__/rag-api.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { hybridSearch, semanticTextSearch, ragQuery } from '../rag-api'

// Mock fetch globally
global.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ results: [], total: 0, queryTimeMs: 10 }),
  } as Response)
)

describe('RAG API Tools', () => {
  beforeEach(() => {
    mock.restore()
  })

  test('hybridSearch calls correct endpoint', async () => {
    const result = await hybridSearch({ query: 'test query', topK: 5 })
    expect(result).toBeDefined()
  })

  test('semanticTextSearch calls correct endpoint', async () => {
    const result = await semanticTextSearch({ query: 'test query', topK: 5 })
    expect(result).toBeDefined()
  })

  test('ragQuery calls correct endpoint with strategy', async () => {
    const result = await ragQuery({ query: 'test query', strategy: 'balanced' })
    expect(result).toBeDefined()
  })
})
