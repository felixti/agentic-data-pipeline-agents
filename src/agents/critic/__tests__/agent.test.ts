// src/agents/critic/__tests__/agent.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { critiqueAnswer } from '../index'

// Mock the LLM response
const mockGenerateText = mock(() =>
  Promise.resolve({
    text: JSON.stringify({
      qualityScore: 0.85,
      needsRefinement: false,
      scores: {
        relevance: 0.9,
        accuracy: 0.85,
        completeness: 0.8,
        clarity: 0.9,
        sourceUsage: 0.8,
      },
    }),
  })
)

// Mock the ai module
mock.module('ai', () => ({
  generateText: mockGenerateText,
}))

describe('Critic Agent', () => {
  beforeEach(() => mock.restore())

  test('critiqueAnswer returns quality score', async () => {
    const result = await critiqueAnswer({
      query: 'What is machine learning?',
      answer: 'Machine learning is a subset of artificial intelligence that uses algorithms to learn from data.',
      sources: [
        { chunkId: '1', content: 'ML is a subset of AI.', score: 0.9 },
      ],
    })
    expect(result.qualityScore).toBeGreaterThanOrEqual(0)
    expect(result.qualityScore).toBeLessThanOrEqual(1)
    expect(result.needsRefinement).toBeDefined()
  })

  test('critiqueAnswer identifies poor answers', async () => {
    // Override mock for this specific test
    mockGenerateText.mockImplementationOnce(() =>
      Promise.resolve({
        text: JSON.stringify({
          qualityScore: 0.3,
          needsRefinement: true,
          refinementReason: 'Answer is too brief and lacks substance',
          scores: {
            relevance: 0.4,
            accuracy: 0.3,
            completeness: 0.2,
            clarity: 0.5,
            sourceUsage: 0.0,
          },
        }),
      })
    )

    const result = await critiqueAnswer({
      query: 'What is machine learning?',
      answer: 'I dont know.',
      sources: [],
    })
    expect(result.needsRefinement).toBe(true)
    expect(result.refinementReason).toBeDefined()
  })
})
