// tests/integration/api/chat.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { mockLLM, mockRAG, restoreMocks } from '../helpers/mocks'
import { llmFixtures } from '../../fixtures/llm-responses'
import { ragFixtures } from '../../fixtures/rag-responses'

// Import app after mocks are set up in each test
describe('API - Chat Endpoint', () => {
  beforeEach(() => {
    restoreMocks()
  })

  describe('POST /api/v1/chat', () => {
    test('returns complete response with all fields', async () => {
      // Setup mocks
      mockLLM()
      mockRAG()

      // Import app after mocks
      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is machine learning?' }),
      })

      expect(res.status).toBe(200)

      const body = (await res.json()) as {
        answer: string
        queryType: string
        qualityScore: number
        sources: Array<{ chunkId: string; content: string; score: number }>
      }

      expect(body.answer).toBeDefined()
      expect(typeof body.answer).toBe('string')
      expect(body.answer.length).toBeGreaterThan(0)

      expect(body.queryType).toBeDefined()
      expect(['factual', 'analytical', 'comparative', 'vague', 'multi_hop']).toContain(body.queryType)

      expect(body.qualityScore).toBeDefined()
      expect(body.qualityScore).toBeGreaterThanOrEqual(0)
      expect(body.qualityScore).toBeLessThanOrEqual(1)

      expect(body.sources).toBeDefined()
      expect(Array.isArray(body.sources)).toBe(true)
    })

    test('returns 400 for missing query', async () => {
      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Query is required')
    })

    test('returns 400 for empty query string', async () => {
      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '' }),
      })

      expect(res.status).toBe(400)
    })

    test('returns answer with source citations', async () => {
      mockLLM({ generator: llmFixtures.generator.withCitations })
      mockRAG(ragFixtures.success)

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Explain ML techniques' }),
      })

      expect(res.status).toBe(200)

      const body = (await res.json()) as { answer: string }
      expect(body.answer).toContain('[1]')
    })
  })
})
