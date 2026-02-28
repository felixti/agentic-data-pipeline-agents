// tests/integration/workflow/refinement.test.ts
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { mockRAG, restoreMocks, resetCallCounts } from '../helpers/mocks'
import { llmFixtures } from '../../fixtures/llm-responses'

describe('Workflow - Refinement Loop', () => {
  beforeEach(() => {
    restoreMocks()
    resetCallCounts()
  })

  test('retries when quality score < 0.7', async () => {
    // First critic call fails, second passes
    let criticCallCount = 0

    mock.module('ai', () => ({
      generateText: mock(async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        // Classifier
        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          return { text: JSON.stringify(llmFixtures.classifier.factual) }
        }

        // Critic - fail first, pass second
        if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
          criticCallCount++
          if (criticCallCount === 1) {
            return { text: JSON.stringify(llmFixtures.critic.fail) }
          }
          return { text: JSON.stringify(llmFixtures.critic.pass) }
        }

        // Generator
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

    // Should have retried (2 iterations)
    expect(result.iterations).toBe(2)
    // Final quality should pass
    expect(result.qualityScore).toBeGreaterThanOrEqual(0.7)
    expect(result.finalAnswer).toBeDefined()
  })

  test('stops retrying after quality passes', async () => {
    // Critic passes on first try
    mock.module('ai', () => ({
      generateText: mock(async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          return { text: JSON.stringify(llmFixtures.classifier.factual) }
        }

        if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
          return { text: JSON.stringify(llmFixtures.critic.pass) }
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

    // Should complete in 1 iteration
    expect(result.iterations).toBe(1)
    expect(result.qualityScore).toBeGreaterThanOrEqual(0.7)
  })

  test('refinement improves answer quality', async () => {
    let generatorCallCount = 0

    mock.module('ai', () => ({
      generateText: mock(async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          return { text: JSON.stringify(llmFixtures.classifier.factual) }
        }

        if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
          // Always fail to test multiple iterations
          return { text: JSON.stringify(llmFixtures.critic.fail) }
        }

        // Generator - return different answers each time
        generatorCallCount++
        return {
          text: `Generated answer attempt ${generatorCallCount}`,
          usage: { totalTokens: 100 },
        }
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

    // Should hit max iterations with latest answer
    expect(result.iterations).toBe(2)
    expect(result.finalAnswer).toBeDefined()
    expect(result.finalAnswer).toContain('Generated answer attempt')
  })
})
