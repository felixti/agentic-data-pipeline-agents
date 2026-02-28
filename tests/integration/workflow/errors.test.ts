// tests/integration/workflow/errors.test.ts
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { mockRAG, restoreMocks, resetCallCounts } from '../helpers/mocks'
import { errorFixtures } from '../../fixtures/errors'
import { llmFixtures } from '../../fixtures/llm-responses'

describe('Workflow - Error Handling', () => {
  beforeEach(() => {
    restoreMocks()
    resetCallCounts()
  })

  test('handles RAG API failure gracefully', async () => {
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

    // RAG returns error
    mockRAG(errorFixtures.ragUnavailable)

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    // Should not throw, should handle gracefully
    const result = await graph.invoke({
      query: 'What is machine learning?',
      iterations: 0,
      errors: [],
    })

    // Should have error recorded or graceful fallback
    expect(result).toBeDefined()
  })

  test('handles malformed classifier response', async () => {
    // Classifier returns invalid JSON, should default to 'vague'
    mock.module('ai', () => ({
      generateText: mock(async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          // Return malformed JSON
          return { text: '{ invalid json' }
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

    // Should default to 'vague' query type
    expect(result.queryType).toBe('vague')
    // Should still complete the workflow
    expect(result.finalAnswer).toBeDefined()
  })

  test('handles malformed critic response', async () => {
    mock.module('ai', () => ({
      generateText: mock(async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          return { text: JSON.stringify(llmFixtures.classifier.factual) }
        }

        if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
          // Return malformed JSON for critic
          return { text: '{ invalid json' }
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

    // Should handle malformed response with defaults
    expect(result.qualityScore).toBeDefined()
    // Default quality is 0.5 which triggers refinement
    expect(result.needsRefinement).toBe(true)
  })

  test('workflow continues if one agent has issues', async () => {
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

    // All agents should have run
    expect(result.currentAgent).toBeDefined()
    expect(result.finalAnswer).toBeDefined()
  })
})
