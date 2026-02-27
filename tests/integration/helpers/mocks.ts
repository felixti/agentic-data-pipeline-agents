// tests/integration/helpers/mocks.ts
import { mock, afterEach } from 'bun:test'
import { llmFixtures } from '../../fixtures/llm-responses'
import { ragFixtures } from '../../fixtures/rag-responses'

// Track call counts for multi-response scenarios
let llmCallCount = 0
let ragCallCount = 0

/**
 * Mock the AI SDK's generateText function
 * Controls responses for classifier, generator, and critic agents
 */
export function mockLLM(options?: {
  classifier?: typeof llmFixtures.classifier.factual
  generator?: string
  critic?: typeof llmFixtures.critic.pass
  sequence?: Array<{ type: 'classifier' | 'generator' | 'critic'; response: unknown }>
}) {
  llmCallCount = 0
  const sequence = options?.sequence

  return mock.module('ai', () => ({
    tool: mock((config: { description: string; inputSchema: unknown; execute: () => unknown }) => config),
    generateText: mock(async (params: { prompt?: string; system?: string }) => {
      llmCallCount++

      // If sequence is provided, use it
      if (sequence) {
        const idx = (llmCallCount - 1) % sequence.length
        const item = sequence[idx]
        if (item.type === 'classifier' || item.type === 'critic') {
          return { text: JSON.stringify(item.response) }
        }
        return { text: item.response, usage: { totalTokens: 100 } }
      }

      // Otherwise, infer from prompt content
      const prompt = params.prompt || ''
      const system = params.system || ''

      if (system.includes('query classifier') || prompt.includes('Classify this query')) {
        const response = options?.classifier || llmFixtures.classifier.factual
        return { text: JSON.stringify(response) }
      }

      if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
        const response = options?.critic || llmFixtures.critic.pass
        return { text: JSON.stringify(response) }
      }

      // Generator
      const text = options?.generator || llmFixtures.generator.success
      return { text, usage: { totalTokens: 100 } }
    }),
  }))
}

/**
 * Mock global.fetch for RAG API calls
 */
export function mockRAG(response?: object | Error) {
  ragCallCount = 0
  const ragResponse = response || ragFixtures.success

  global.fetch = mock(async (url: string, options?: { method?: string; body?: string }) => {
    ragCallCount++

    if (ragResponse instanceof Error) {
      throw ragResponse
    }

    // Check if this is an error response object
    if (ragResponse && 'ok' in ragResponse && ragResponse.ok === false) {
      return ragResponse as Response
    }

    return {
      ok: true,
      status: 200,
      json: async () => ragResponse,
      text: async () => JSON.stringify(ragResponse),
    } as Response
  }) as unknown as typeof fetch
}

/**
 * Mock RAG to return error response
 */
export function mockRAGError(error: { ok: false; status: number; statusText: string }) {
  global.fetch = mock(async () => error as Response) as unknown as typeof fetch
}

/**
 * Mock LLM to throw an error
 */
export function mockLLMError(error: Error) {
  return mock.module('ai', () => ({
    tool: mock((config: { description: string; inputSchema: unknown; execute: () => unknown }) => config),
    generateText: mock(async () => {
      throw error
    }),
  }))
}

/**
 * Mock LLM to return malformed JSON
 */
export function mockLLMMalformed() {
  return mock.module('ai', () => ({
    tool: mock((config: { description: string; inputSchema: unknown; execute: () => unknown }) => config),
    generateText: mock(async () => ({
      text: '{ invalid json',
    })),
  }))
}

/**
 * Get current call counts (useful for assertions)
 */
export function getCallCounts() {
  return { llmCallCount, ragCallCount }
}

/**
 * Reset call counts
 */
export function resetCallCounts() {
  llmCallCount = 0
  ragCallCount = 0
}

/**
 * Restore all mocks
 */
export function restoreMocks() {
  mock.restore()
  resetCallCounts()
}
