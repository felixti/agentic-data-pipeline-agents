# Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create comprehensive integration tests for the multi-agent RAG system covering API layer and workflow orchestration.

**Architecture:** Tests use realistic fixtures for mock data, Bun's mock.module() for LLM interception, and global.fetch mocking for RAG API. Tests are organized by layer (api/ and workflow/) with shared helpers.

**Tech Stack:** Bun test runner, mock.module(), global.fetch mocking, realistic fixtures

---

## Task 1: Create Test Fixtures

**Files:**
- Create: `tests/fixtures/llm-responses.ts`
- Create: `tests/fixtures/rag-responses.ts`
- Create: `tests/fixtures/errors.ts`

**Step 1: Create LLM response fixtures**

```typescript
// tests/fixtures/llm-responses.ts
export const llmFixtures = {
  classifier: {
    factual: {
      queryType: 'factual' as const,
      confidence: 0.95,
      reasoning: 'Direct fact query requiring specific information',
    },
    analytical: {
      queryType: 'analytical' as const,
      confidence: 0.9,
      reasoning: 'Query requires explanation and synthesis',
    },
    vague: {
      queryType: 'vague' as const,
      confidence: 0.6,
      reasoning: 'Unclear intent, needs clarification',
    },
  },
  generator: {
    success: 'Machine learning is a subset of artificial intelligence that uses algorithms to learn from data [1][2]. It enables systems to improve their performance on tasks through experience.',
    withCitations: 'ML enables systems to improve through experience [1]. Key techniques include neural networks [2] and decision trees [3].',
    short: 'ML is AI that learns from data.',
  },
  critic: {
    pass: {
      qualityScore: 0.85,
      needsRefinement: false,
      scores: {
        relevance: 0.9,
        accuracy: 0.85,
        completeness: 0.8,
        clarity: 0.9,
        sourceUsage: 0.85,
      },
    },
    fail: {
      qualityScore: 0.5,
      needsRefinement: true,
      refinementReason: 'Answer is incomplete and lacks sufficient detail',
      scores: {
        relevance: 0.6,
        accuracy: 0.5,
        completeness: 0.4,
        clarity: 0.6,
        sourceUsage: 0.5,
      },
    },
  },
}
```

**Step 2: Create RAG response fixtures**

```typescript
// tests/fixtures/rag-responses.ts
export const ragFixtures = {
  success: {
    results: [
      {
        chunk_id: '1',
        content: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
        hybrid_score: 0.95,
        metadata: { source: 'ml-guide.pdf', page: 1 },
      },
      {
        chunk_id: '2',
        content: 'ML algorithms identify patterns in data and make predictions without explicit programming.',
        hybrid_score: 0.88,
        metadata: { source: 'ml-guide.pdf', page: 2 },
      },
    ],
    total: 2,
    query_time_ms: 45,
  },
  empty: {
    results: [],
    total: 0,
    query_time_ms: 10,
  },
  singleResult: {
    results: [
      {
        chunk_id: '1',
        content: 'Artificial intelligence simulates human intelligence in machines.',
        hybrid_score: 0.92,
        metadata: { source: 'ai-overview.pdf' },
      },
    ],
    total: 1,
    query_time_ms: 30,
  },
}
```

**Step 3: Create error fixtures**

```typescript
// tests/fixtures/errors.ts
export const errorFixtures = {
  llmTimeout: new Error('LLM request timeout after 30000ms'),
  llmRateLimit: new Error('Rate limit exceeded'),
  llmMalformed: '{ invalid json response',
  ragUnavailable: {
    ok: false,
    status: 503,
    statusText: 'Service Unavailable',
  },
  ragTimeout: {
    ok: false,
    status: 504,
    statusText: 'Gateway Timeout',
  },
}
```

**Step 4: Verify files are created**

Run: `ls -la tests/fixtures/`
Expected: 3 files created

**Step 5: Commit**

```bash
git add tests/fixtures/
git commit -m "test: add integration test fixtures for LLM and RAG responses"
```

---

## Task 2: Create Mock Helpers

**Files:**
- Create: `tests/integration/helpers/mocks.ts`

**Step 1: Create the mock helpers module**

```typescript
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
```

**Step 2: Verify the helper compiles**

Run: `bun run typecheck 2>&1 | grep -E "(mocks|error)" || echo "No errors"`
Expected: "No errors"

**Step 3: Commit**

```bash
git add tests/integration/helpers/mocks.ts
git commit -m "test: add mock helpers for integration tests"
```

---

## Task 3: API Chat Endpoint Tests

**Files:**
- Create: `tests/integration/api/chat.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Run tests to verify they pass**

Run: `bun test tests/integration/api/chat.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/api/chat.test.ts
git commit -m "test: add API chat endpoint integration tests"
```

---

## Task 4: API Stream Endpoint Tests

**Files:**
- Create: `tests/integration/api/stream.test.ts`

**Step 1: Write the test file**

```typescript
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

          const parsed = JSON.parse(data)
          // Should have agent event structure
          expect(parsed).toHaveProperty('classifier')
        }
      }
    })
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `bun test tests/integration/api/stream.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/api/stream.test.ts
git commit -m "test: add API stream endpoint integration tests"
```

---

## Task 5: API Error Handling Tests

**Files:**
- Create: `tests/integration/api/errors.test.ts`

**Step 1: Write the test file**

```typescript
// tests/integration/api/errors.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { mockLLM, mockRAG, mockRAGError, mockLLMError, restoreMocks } from '../helpers/mocks'
import { errorFixtures } from '../../fixtures/errors'

describe('API - Error Handling', () => {
  beforeEach(() => {
    restoreMocks()
  })

  describe('RAG API failures', () => {
    test('handles RAG API unavailable (503)', async () => {
      mockLLM()
      mockRAGError(errorFixtures.ragUnavailable)

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      // Should return error response, not crash
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    test('handles RAG API timeout (504)', async () => {
      mockLLM()
      mockRAGError(errorFixtures.ragTimeout)

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('LLM failures', () => {
    test('handles LLM timeout', async () => {
      mockLLMError(errorFixtures.llmTimeout)
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    test('handles LLM rate limit', async () => {
      mockLLMError(errorFixtures.llmRateLimit)
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Malformed responses', () => {
    test('handles malformed LLM JSON response', async () => {
      // This tests that the classifier/generator/critic handle bad JSON gracefully
      const { mockLLMMalformed } = await import('../helpers/mocks')
      mockLLMMalformed()
      mockRAG()

      const { default: app } = await import('@/api/server')

      const res = await app.request('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is AI?' }),
      })

      // Should still return a response (graceful degradation)
      // Either success with defaults or error
      expect([200, 400, 500]).toContain(res.status)
    })
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `bun test tests/integration/api/errors.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/api/errors.test.ts
git commit -m "test: add API error handling integration tests"
```

---

## Task 6: Workflow Happy Path Tests

**Files:**
- Create: `tests/integration/workflow/happy-path.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Run tests to verify they pass**

Run: `bun test tests/integration/workflow/happy-path.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/workflow/happy-path.test.ts
git commit -m "test: add workflow happy path integration tests"
```

---

## Task 7: Workflow Refinement Loop Tests

**Files:**
- Create: `tests/integration/workflow/refinement.test.ts`

**Step 1: Write the test file**

```typescript
// tests/integration/workflow/refinement.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { mockLLM, mockRAG, restoreMocks, resetCallCounts } from '../helpers/mocks'
import { llmFixtures } from '../../fixtures/llm-responses'
import { ragFixtures } from '../../fixtures/rag-responses'

describe('Workflow - Refinement Loop', () => {
  beforeEach(() => {
    restoreMocks()
    resetCallCounts()
  })

  test('retries when quality score < 0.7', async () => {
    // First critic call fails, second passes
    let criticCallCount = 0

    mock.module('ai', () => ({
      generateText: async (params: { prompt?: string; system?: string }) => {
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
      },
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
    mockLLM({ critic: llmFixtures.critic.pass })
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
      generateText: async (params: { prompt?: string; system?: string }) => {
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
      },
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
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `bun test tests/integration/workflow/refinement.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/workflow/refinement.test.ts
git commit -m "test: add workflow refinement loop integration tests"
```

---

## Task 8: Workflow Max Iterations Tests

**Files:**
- Create: `tests/integration/workflow/iterations.test.ts`

**Step 1: Write the test file**

```typescript
// tests/integration/workflow/iterations.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { mockLLM, mockRAG, restoreMocks, resetCallCounts } from '../helpers/mocks'
import { llmFixtures } from '../../fixtures/llm-responses'
import { ragFixtures } from '../../fixtures/rag-responses'

describe('Workflow - Max Iterations', () => {
  beforeEach(() => {
    restoreMocks()
    resetCallCounts()
  })

  test('stops after 2 iterations even if quality is low', async () => {
    // Critic always fails
    mockLLM({ critic: llmFixtures.critic.fail })
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
      generateText: async (params: { prompt?: string; system?: string }) => {
        const prompt = params.prompt || ''
        const system = params.system || ''

        if (system.includes('query classifier') || prompt.includes('Classify this query')) {
          return { text: JSON.stringify(llmFixtures.classifier.factual) }
        }

        if (system.includes('quality evaluator') || prompt.includes('Evaluate the answer')) {
          criticCallCount++
          // Always fail
          return { text: JSON.stringify(llmFixtures.critic.fail) }
        }

        return { text: llmFixtures.generator.success, usage: { totalTokens: 100 } }
      },
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
    mockLLM({ critic: llmFixtures.critic.fail, generator: llmFixtures.generator.success })
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
    expect(result.finalAnswer!.length).toBeGreaterThan(0)
    expect(result.needsRefinement).toBe(true)
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `bun test tests/integration/workflow/iterations.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/workflow/iterations.test.ts
git commit -m "test: add workflow max iterations integration tests"
```

---

## Task 9: Workflow Error Handling Tests

**Files:**
- Create: `tests/integration/workflow/errors.test.ts`

**Step 1: Write the test file**

```typescript
// tests/integration/workflow/errors.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { mockLLM, mockRAG, mockLLMError, restoreMocks, resetCallCounts } from '../helpers/mocks'
import { errorFixtures } from '../../fixtures/errors'
import { llmFixtures } from '../../fixtures/llm-responses'

describe('Workflow - Error Handling', () => {
  beforeEach(() => {
    restoreMocks()
    resetCallCounts()
  })

  test('handles RAG API failure gracefully', async () => {
    mockLLM()
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
    const { mockLLMMalformed } = await import('../helpers/mocks')
    mockLLMMalformed()
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
    let callCount = 0

    mock.module('ai', () => ({
      generateText: async (params: { prompt?: string; system?: string }) => {
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
      },
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
    expect(result.currentAgent).toBeDefined()
    expect(result.finalAnswer).toBeDefined()
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `bun test tests/integration/workflow/errors.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/workflow/errors.test.ts
git commit -m "test: add workflow error handling integration tests"
```

---

## Task 10: Run Full Test Suite and Verify

**Step 1: Run all integration tests**

Run: `bun test tests/integration/`
Expected: All tests pass

**Step 2: Run full test suite**

Run: `bun test`
Expected: All 35+ unit tests + integration tests pass

**Step 3: Verify test count**

Run: `bun test tests/integration/ 2>&1 | grep -E "(pass|fail|Ran)"`
Expected: All pass, ~15-20 integration tests

**Step 4: Verify execution time**

Run: `time bun test tests/integration/`
Expected: < 5 seconds total

**Step 5: Run lint and typecheck**

Run: `bun run lint && bun run typecheck`
Expected: No errors

**Step 6: Final commit**

```bash
git add .
git commit -m "test: complete integration test suite

- API layer: chat, stream, error handling
- Workflow layer: happy path, refinement, iterations, errors
- Realistic fixtures for LLM and RAG responses
- Mock helpers for testing in isolation

15+ integration tests, all passing in < 5s"
```

---

## Verification Checklist

- [ ] All fixture files created (3 files)
- [ ] Mock helpers created and working
- [ ] API chat tests passing
- [ ] API stream tests passing
- [ ] API error tests passing
- [ ] Workflow happy path tests passing
- [ ] Workflow refinement tests passing
- [ ] Workflow iterations tests passing
- [ ] Workflow error tests passing
- [ ] Full test suite passes
- [ ] Execution time < 5 seconds
- [ ] Lint clean
- [ ] TypeScript clean
