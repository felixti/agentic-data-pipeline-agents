// tests/integration/api/stream.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { mockLLM, mockRAG, restoreMocks } from '../helpers/mocks'

describe('API - Stream Endpoint', () => {
  beforeEach(() => {
    restoreMocks()
  })

  describe('POST /api/v1/chat/stream', () => {
    test('returns SSE content-type header', async () => {
      mockLLM()
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')
    })

    test('returns 400 for missing query', async () => {
      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    test('streams agent_update events', async () => {
      mockLLM()
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      expect(res.status).toBe(200)

      // Read the stream
      const reader = res.body?.getReader()
      expect(reader).toBeDefined()

      const decoder = new TextDecoder()
      const events: string[] = []

      // Read a few chunks
      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader!.read()
        if (done) break

        const chunk = decoder.decode(value)
        events.push(chunk)

        // Check for event format
        if (chunk.includes('event:')) {
          expect(chunk).toContain('event: agent_update')
        }
      }

      // Should have received some events
      expect(events.length).toBeGreaterThan(0)
    })

    test('event data contains valid JSON', async () => {
      mockLLM()
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      // Read chunks and parse data
      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader!.read()
        if (done) break

        const chunk = decoder.decode(value)
        const dataMatch = chunk.match(/data: (.+)/)

        if (dataMatch) {
          const data = dataMatch[1]
          // Should be valid JSON
          expect(() => JSON.parse(data)).not.toThrow()
        }
      }
    })
  })
})
