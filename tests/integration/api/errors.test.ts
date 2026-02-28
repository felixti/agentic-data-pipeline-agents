// tests/integration/api/errors.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { mockLLM, mockRAG, mockRAGError, mockLLMError, restoreMocks } from '../helpers/mocks'
import { errorFixtures } from '../../fixtures/errors'

describe('API - Error Handling', () => {
  beforeEach(() => {
    restoreMocks()
  })

  describe('RAG API failures', () => {
    test('handles RAG API unavailable (503)', async () => {
      mockLLM()
      mockRAGError(errorFixtures.ragUnavailable)

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      // Should return error response, not crash
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    test('handles RAG API timeout (504)', async () => {
      mockLLM()
      mockRAGError(errorFixtures.ragTimeout)

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('LLM failures', () => {
    test('handles LLM timeout', async () => {
      mockLLMError(errorFixtures.llmTimeout)
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    test('handles LLM rate limit', async () => {
      mockLLMError(errorFixtures.llmRateLimit)
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Malformed responses', () => {
    test('handles malformed LLM JSON response', async () => {
      // This tests that the classifier/generator/critic handle bad JSON gracefully
      const { mockLLMMalformed } = await import('../helpers/mocks')
      mockLLMMalformed()
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      // Should still return a response (graceful degradation)
      // Either success with defaults or error
      expect([200, 400, 500]).toContain(res.status)
    })
  })
})
