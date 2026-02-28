// tests/integration/workflow/iterations.test.ts
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { mockRAG, restoreMocks, resetCallCounts } from '../helpers/mocks'
import { llmFixtures } from '../../fixtures/llm-responses'

describe('Workflow - Max Iterations', () => {
  beforeEach(() => {
    restoreMocks()
    resetCallCounts()
  })

  test('stops after 2 iteration even if quality is low', async () => {
    // Critic always fails - should hit max iterations
    mock.module('ai', () => ({
      generateText: mock(async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          return { text: JSON.stringify(llmFixtures.classifier.factual) }
        }

        if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
          return { text: JSON.stringify(llmFixtures.critic.fail) }
        }

        return { text: llmFixtures.generator.success, usage: { totalTokens: 100 } }
      }),
      tool: mock(() => ({})),
    }))

    mockRAG()

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    const result = await graph.invoke({
      query: 'What is machine learning?',
      iterations: 0,
      errors: [],
    })

    // Should stop at max iterations (2)
    expect(result.iterations).toBe(2)
    // Quality should still be low
    expect(result.qualityScore).toBeLessThan(0.7)
    // But should still return best effort answer
    expect(result.finalAnswer).toBeDefined()
  })

  test('does not exceed max iterations limit', async () => {
    let criticCallCount = 0

    mock.module('ai', () => ({
      generateText: mock(async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          return { text: JSON.stringify(llmFixtures.classifier.factual) }
        }

        if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
          criticCallCount++
          return { text: JSON.stringify(llmFixtures.critic.fail) }
        }

        return { text: llmFixtures.generator.success, usage: { totalTokens: 100 } }
      }),
      tool: mock(() => ({})),
    }))

    mockRAG()

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    await graph.invoke({
      query: 'What is machine learning?',
      iterations: 0,
      errors: [],
    })

    // Critic should only be called twice (max iterations)
    expect(criticCallCount).toBe(2)
  })

  test('returns best effort answer when max iterations reached', async () => {
    mock.module('ai', () => ({
      generateText: mock(async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          return { text: JSON.stringify(llmFixtures.classifier.factual) }
        }

        if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
          return { text: JSON.stringify(llmFixtures.critic.fail) }
        }

        return { text: llmFixtures.generator.success, usage: { totalTokens: 100 } }
      }),
      tool: mock(() => ({})),
    }))

    mockRAG()

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    const result = await graph.invoke({
      query: 'What is machine learning?',
      iterations: 0,
      errors: [],
    })

    // Even with failed quality, should return an answer
    expect(result.finalAnswer).toBeDefined()
    expect(result.finalAnswer!.length).toBeGreaterThan(1)
    expect(result.needsRefinement).toBe(true)
  })
})
