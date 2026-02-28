// tests/integration/workflow/happy-path.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { mockLLM, mockRAG, restoreMocks, getCallCounts, resetCallCounts } from '../helpers/mocks'
import { llmFixtures } from '../../fixtures/llm-responses'
import { ragFixtures } from '../../fixtures/rag-responses'

describe('Workflow - Happy Path', () => {
  beforeEach(() => {
    restoreMocks()
    resetCallCounts()
  })

  test('completes full agent chain successfully', async () => {
    mockLLM()
    mockRAG()

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    const result = await graph.invoke({
      query: 'What is machine learning?',
      iterations: 0,
      errors: [],
    })

    // All agents should have run
    expect(result.finalAnswer).toBeDefined()
    expect(typeof result.finalAnswer).toBe('string')
    expect(result.finalAnswer!.length).toBeGreaterThan(0)

    expect(result.queryType).toBeDefined()
    expect(result.retrievedChunks).toBeDefined()
    expect(result.qualityScore).toBeDefined()
    expect(result.qualityScore).toBeGreaterThanOrEqual(0.7) // Should pass quality check

    // Should complete in 1 iteration
    expect(result.iterations).toBe(1)
  })

  test('classifies query type correctly', async () => {
    mockLLM({ classifier: llmFixtures.classifier.factual })
    mockRAG()

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    const result = await graph.invoke({
      query: 'What is the capital of France?',
      iterations: 0,
      errors: [],
    })

    expect(result.queryType).toBe('factual')
    expect(result.classificationConfidence).toBeGreaterThan(0.9)
  })

  test('handles analytical queries', async () => {
    mockLLM({ classifier: llmFixtures.classifier.analytical })
    mockRAG()

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    const result = await graph.invoke({
      query: 'Explain how neural networks work',
      iterations: 0,
      errors: [],
    })

    expect(result.queryType).toBe('analytical')
  })

  test('retrieves relevant chunks', async () => {
    mockLLM()
    mockRAG(ragFixtures.success)

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    const result = await graph.invoke({
      query: 'What is machine learning?',
      iterations: 0,
      errors: [],
    })

    expect(result.retrievedChunks).toBeDefined()
    expect(result.retrievedChunks!.length).toBeGreaterThan(0)
    expect(result.retrievedChunks![0].chunkId).toBeDefined()
    expect(result.retrievedChunks![0].content).toBeDefined()
    expect(result.retrievedChunks![0].score).toBeGreaterThan(0)
  })

  test('generates answer with citations', async () => {
    mockLLM({ generator: llmFixtures.generator.withCitations })
    mockRAG(ragFixtures.success)

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    const result = await graph.invoke({
      query: 'Explain ML techniques',
      iterations: 0,
      errors: [],
    })

    expect(result.finalAnswer).toContain('[1]')
  })

  test('handles empty RAG results gracefully', async () => {
    mockLLM()
    mockRAG(ragFixtures.empty)

    const { createAgentGraph } = await import('@/agents/supervisor/graph')
    const graph = createAgentGraph()

    const result = await graph.invoke({
      query: 'What is quantum computing?',
      iterations: 0,
      errors: [],
    })

    // Should still produce an answer even with no sources
    expect(result.finalAnswer).toBeDefined()
    expect(result.retrievedChunks).toEqual([])
  })
})
