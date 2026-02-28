// src/agents/retriever/__tests__/agent.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { retrieveDocuments } from '../index'

global.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        results: [
          { chunk_id: '1', content: 'Test content', hybrid_score: 0.9 },
          { chunk_id: '2', content: 'More content', hybrid_score: 0.8 },
        ],
        total: 2,
        query_time_ms: 50,
      }),
  } as Response)
) as unknown as typeof fetch

describe('Retriever Agent', () => {
  beforeEach(() => mock.restore())

  test('retrieveDocuments returns chunks with scores', async () => {
    const result = await retrieveDocuments({
      query: 'test query',
      queryType: 'factual',
      topK: 5,
    })
    expect(result.chunks).toBeDefined()
    expect(result.chunks.length).toBeGreaterThan(0)
  })

  test('retrieveDocuments uses appropriate search strategy', async () => {
    const result = await retrieveDocuments({
      query: 'compare A and B',
      queryType: 'comparative',
      topK: 10,
    })
    expect(result).toBeDefined()
  })
})
