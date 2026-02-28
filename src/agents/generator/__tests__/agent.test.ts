// src/agents/generator/__tests__/agent.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { generateAnswer } from '../index'
import type { RetrievedChunk } from '@/core/state'

const mockChunks: RetrievedChunk[] = [
  { chunkId: '1', content: 'Machine learning is a subset of AI.', score: 0.9 },
  { chunkId: '2', content: 'It uses algorithms to learn from data.', score: 0.85 },
]

// Mock fetch globally to avoid actual API calls
global.fetch = mock(() => {
  const responseData = {
    choices: [
      {
        message: {
          content:
            'Machine learning is a subset of artificial intelligence that uses algorithms to learn from data [1][2]. It enables systems to improve their performance on tasks through experience.',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      total_tokens: 50,
      prompt_tokens: 30,
      completion_tokens: 20,
    },
  }
  return Promise.resolve({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(JSON.stringify(responseData)),
    json: () => Promise.resolve(responseData),
  } as Response)
}) as unknown as typeof fetch

describe('Generator Agent', () => {
  beforeEach(() => mock.restore())

  test('generateAnswer returns answer with sources', async () => {
    const result = await generateAnswer({
      query: 'What is machine learning?',
      chunks: mockChunks,
    })
    expect(result.answer).toBeDefined()
    expect(result.answer.length).toBeGreaterThan(0)
    expect(result.sources.length).toBeGreaterThan(0)
  })

  test('generateAnswer includes source attribution', async () => {
    const result = await generateAnswer({
      query: 'What is machine learning?',
      chunks: mockChunks,
    })
    expect(result.sources[0]?.chunkId).toBeDefined()
  })
})
