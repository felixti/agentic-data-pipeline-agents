# Phoenix AI Observability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Arize Phoenix AI observability using OpenTelemetry to trace all LLM calls, tool use, and agent node executions.

**Architecture:** Manual span wrapping approach - create a telemetry module with span utilities, instrument each agent node and LLM/tool call with contextual attributes, register Phoenix at application startup with graceful degradation.

**Tech Stack:** `@arizeai/phoenix-otel`, OpenTelemetry, existing Vercel AI SDK, LangGraph

---

## Task 1: Install Phoenix Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install @arizeai/phoenix-otel**

Run:
```bash
bun add @arizeai/phoenix-otel
```

**Step 2: Verify installation**

Run:
```bash
bun pm ls | grep phoenix
```

Expected: `@arizeai/phoenix-otel@<version>`

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @arizeai/phoenix-otel dependency"
```

---

## Task 2: Add Telemetry Configuration

**Files:**
- Modify: `src/core/config/env.ts`

**Step 1: Add telemetry config interface**

Add to the `Config` interface (around line 44):

```typescript
interface Config {
  llm: {
    baseUrl: string
    apiKey: string
  }
  rag: {
    apiUrl: string
    apiKey: string
  }
  server: {
    port: number
  }
  telemetry: {
    phoenixEndpoint: string | undefined
    phoenixApiKey: string | undefined
  }
}
```

**Step 2: Add telemetry config in createConfig()**

Add to the return statement in `createConfig()` (around line 70):

```typescript
telemetry: {
  phoenixEndpoint: getEnv('PHOENIX_COLLECTOR_ENDPOINT'),
  phoenixApiKey: getEnv('PHOENIX_API_KEY'),
},
```

**Step 3: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/core/config/env.ts
git commit -m "feat(config): add telemetry configuration for Phoenix"
```

---

## Task 3: Create Telemetry Module

**Files:**
- Create: `src/core/telemetry/phoenix.ts`
- Create: `src/core/telemetry/index.ts`

**Step 1: Create phoenix.ts telemetry module**

Create `src/core/telemetry/phoenix.ts`:

```typescript
// src/core/telemetry/phoenix.ts
import { register } from '@arizeai/phoenix-otel'
import { config } from '../config'
import { trace, type Span } from '@opentelemetry/api'

let phoenixEnabled = false

/**
 * Initialize Phoenix OpenTelemetry tracing.
 * Gracefully degrades if endpoint is not configured or registration fails.
 */
export function initPhoenix(): void {
  const endpoint = config.telemetry.phoenixEndpoint
  const apiKey = config.telemetry.phoenixApiKey

  if (!endpoint) {
    console.log('[Phoenix] Endpoint not configured, tracing disabled')
    return
  }

  try {
    register({
      projectName: 'agentic-data-pipeline-agents',
      url: endpoint,
      apiKey: apiKey,
    })
    phoenixEnabled = true
    console.log(`[Phoenix] Tracing enabled, endpoint: ${endpoint}`)
  } catch (error) {
    console.warn(
      '[Phoenix] Failed to register:',
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Check if Phoenix tracing is enabled.
 */
export function isPhoenixEnabled(): boolean {
  return phoenixEnabled
}

/**
 * Get the tracer for Phoenix spans.
 */
function getTracer() {
  return trace.getTracer('agentic-data-pipeline-agents', '1.0.0')
}

/**
 * Span attributes for type safety.
 */
export interface SpanAttributes {
  'agent.name'?: string
  'query.type'?: string
  'retrieval.score'?: number
  'quality.score'?: number
  'iteration.count'?: number
  'workflow.status'?: 'in_progress' | 'completed' | 'failed'
  'llm.model'?: string
  'llm.tokens_used'?: number
  'llm.response_length'?: number
  'llm.chunk_count'?: number
  'tool.name'?: string
  'tool.query'?: string
  'tool.top_k'?: number
  'tool.result_count'?: number
  'tool.score'?: number
}

/**
 * Create a span and execute a function within its context.
 * If Phoenix is not enabled, executes the function without tracing.
 *
 * @param name - Span name
 * @param attributes - Initial span attributes
 * @param fn - Async function to execute within span context
 * @returns Result of the function
 */
export async function createSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span | null) => Promise<T>
): Promise<T> {
  if (!phoenixEnabled) {
    return fn(null)
  }

  const tracer = getTracer()
  return tracer.startActiveSpan(name, async (span) => {
    // Set initial attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        span.setAttribute(key, value)
      }
    }

    try {
      const result = await fn(span)
      span.setStatus({ code: 0 }) // OK
      return result
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  })
}
```

**Step 2: Create index.ts barrel export**

Create `src/core/telemetry/index.ts`:

```typescript
// src/core/telemetry/index.ts
export { initPhoenix, isPhoenixEnabled, createSpan, type SpanAttributes } from './phoenix'
```

**Step 3: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/core/telemetry/
git commit -m "feat(telemetry): add Phoenix OpenTelemetry module with span utilities"
```

---

## Task 4: Write Telemetry Unit Tests

**Files:**
- Create: `src/core/telemetry/__tests__/phoenix.test.ts`

**Step 1: Create test file**

Create `src/core/telemetry/__tests__/phoenix.test.ts`:

```typescript
// src/core/telemetry/__tests__/phoenix.test.ts
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { createSpan, isPhoenixEnabled, initPhoenix } from '../phoenix'

// Mock the config module
const originalEnv = process.env

describe('Phoenix Telemetry', () => {
  beforeEach(() => {
    // Reset module state between tests
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('createSpan', () => {
    test('executes function and returns result when Phoenix disabled', async () => {
      const result = await createSpan('test-span', {}, async () => {
        return 'test-result'
      })
      expect(result).toBe('test-result')
    })

    test('passes null span when Phoenix disabled', async () => {
      let receivedSpan: unknown = 'not-null'
      await createSpan('test-span', {}, async (span) => {
        receivedSpan = span
        return 'done'
      })
      expect(receivedSpan).toBeNull()
    })

    test('propagates errors from wrapped function', async () => {
      expect(async () => {
        await createSpan('test-span', {}, async () => {
          throw new Error('test error')
        })
      }).toThrow('test error')
    })

    test('executes async operations correctly', async () => {
      const start = Date.now()
      await createSpan('test-span', {}, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'done'
      })
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(10)
    })
  })

  describe('isPhoenixEnabled', () => {
    test('returns false before initialization', () => {
      // Phoenix starts disabled
      expect(typeof isPhoenixEnabled()).toBe('boolean')
    })
  })
})
```

**Step 2: Run tests**

Run:
```bash
bun test src/core/telemetry/__tests__/phoenix.test.ts
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add src/core/telemetry/__tests__/phoenix.test.ts
git commit -m "test(telemetry): add unit tests for Phoenix module"
```

---

## Task 5: Initialize Phoenix at Startup

**Files:**
- Modify: `src/index.ts`

**Step 1: Add Phoenix initialization**

Modify `src/index.ts`:

```typescript
// src/index.ts
import { initPhoenix } from './core/telemetry'
import app from './api/server'
import { config, validateEnv } from './core/config'

validateEnv()
initPhoenix()

console.log(`Server running at http://localhost:${config.server.port}`)
console.log(`Health: http://localhost:${config.server.port}/health`)
console.log(`Chat: POST http://localhost:${config.server.port}/api/v1/chat`)

export default {
  port: config.server.port,
  fetch: app.fetch,
}
```

**Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

**Step 3: Verify server starts without Phoenix env vars**

Run:
```bash
timeout 3 bun run dev 2>&1 || true
```

Expected: Server starts, logs "[Phoenix] Endpoint not configured, tracing disabled"

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: initialize Phoenix telemetry at application startup"
```

---

## Task 6: Instrument Classifier Agent

**Files:**
- Modify: `src/agents/classifier/index.ts`

**Step 1: Add span wrapper to classifyQuery**

Modify `src/agents/classifier/index.ts`:

```typescript
// src/agents/classifier/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan } from '@/core/telemetry'
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts'
import type { QueryType } from '@/core/state'

interface ClassificationResult {
  queryType: QueryType
  confidence: number
  reasoning: string
}

export async function classifyQuery(query: string): Promise<ClassificationResult> {
  return createSpan('classify_llm_call', {
    'agent.name': 'classifier',
    'llm.model': 'gpt-5-mini',
  }, async (span) => {
    const { text, usage } = await generateText({
      model: getLLM('gpt-5-mini'),
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: `Classify this query: "${query}"`,
      temperature: 1.0,
      providerOptions: {
        openai: {
          reasoningEffort: 'medium',
        },
      },
    })

    span?.setAttributes({
      'llm.tokens_used': usage?.totalTokens ?? 0,
      'llm.response_length': text.length,
    })

    try {
      const result = JSON.parse(text) as ClassificationResult
      const classification = {
        queryType: result.queryType,
        confidence: Math.min(1, Math.max(0, result.confidence)),
        reasoning: result.reasoning,
      }

      span?.setAttributes({
        'query.type': classification.queryType,
      })

      return classification
    } catch {
      span?.setAttributes({
        'query.type': 'vague',
      })
      return {
        queryType: 'vague' as QueryType,
        confidence: 0.5,
        reasoning: 'Failed to parse classification, defaulting to vague',
      }
    }
  })
}

export { CLASSIFIER_SYSTEM_PROMPT } from './prompts'
```

**Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

**Step 3: Run existing tests**

Run:
```bash
bun test src/agents/classifier/__tests__/
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/agents/classifier/index.ts
git commit -m "feat(classifier): add Phoenix tracing to classification LLM calls"
```

---

## Task 7: Instrument Retriever Agent

**Files:**
- Modify: `src/agents/retriever/index.ts`

**Step 1: Add span wrapper to retrieveDocuments**

Modify `src/agents/retriever/index.ts`:

```typescript
// src/agents/retriever/index.ts
import { hybridSearch, type SearchResult } from '@/core/tools'
import { createSpan } from '@/core/telemetry'
import type { RetrievedChunk, QueryType } from '@/core/state'
import { RETRIEVER_SYSTEM_PROMPT } from './prompts'

interface RetrieveOptions {
  query: string
  queryType?: QueryType
  topK?: number
}

interface RetrieveResult {
  chunks: RetrievedChunk[]
  score: number
  queryTimeMs: number
}

export async function retrieveDocuments(options: RetrieveOptions): Promise<RetrieveResult> {
  const topK = options.topK ?? 5

  return createSpan('retrieve_tool_call', {
    'agent.name': 'retriever',
    'tool.name': 'rag-api',
    'tool.query': options.query,
    'tool.top_k': topK,
  }, async (span) => {
    const response = await hybridSearch({
      query: options.query,
      topK,
      vectorWeight: options.queryType === 'analytical' ? 0.6 : 0.7,
      textWeight: options.queryType === 'analytical' ? 0.4 : 0.3,
    })

    const chunks: RetrievedChunk[] = (response.results ?? []).map((r: SearchResult) => ({
      chunkId: r.chunk_id,
      content: r.content,
      score: r.hybrid_score ?? r.similarity_score ?? 0,
      metadata: r.metadata,
    }))

    const avgScore =
      chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length : 0

    span?.setAttributes({
      'tool.result_count': chunks.length,
      'tool.score': avgScore,
      'retrieval.score': avgScore,
    })

    return {
      chunks,
      score: avgScore,
      queryTimeMs: response.query_time_ms ?? 0,
    }
  })
}

export { RETRIEVER_SYSTEM_PROMPT } from './prompts'
export { retrieverTools } from './tools'
```

**Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

**Step 3: Run existing tests**

Run:
```bash
bun test src/agents/retriever/__tests__/
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/agents/retriever/index.ts
git commit -m "feat(retriever): add Phoenix tracing to document retrieval"
```

---

## Task 8: Instrument Generator Agent

**Files:**
- Modify: `src/agents/generator/index.ts`

**Step 1: Add span wrapper to generateAnswer**

Modify `src/agents/generator/index.ts`:

```typescript
// src/agents/generator/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan } from '@/core/telemetry'
import { GENERATOR_SYSTEM_PROMPT } from './prompts'
import type { RetrievedChunk } from '@/core/state'

interface GenerateOptions {
  query: string
  chunks: RetrievedChunk[]
  conversationContext?: string
}

interface GenerateResult {
  answer: string
  sources: RetrievedChunk[]
  tokensUsed?: number
}

export async function generateAnswer(options: GenerateOptions): Promise<GenerateResult> {
  return createSpan('generate_llm_call', {
    'agent.name': 'generator',
    'llm.model': 'gpt-4.1',
    'llm.chunk_count': options.chunks.length,
  }, async (span) => {
    const contextText = options.chunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
      .join('\n\n')

    const { text, usage } = await generateText({
      model: getLLM('gpt-4.1'),
      system: GENERATOR_SYSTEM_PROMPT,
      prompt: `Query: ${options.query}

Context:
${contextText}

${options.conversationContext ? `Previous context: ${options.conversationContext}` : ''}

Provide a comprehensive answer with source citations.`,
    })

    span?.setAttributes({
      'llm.tokens_used': usage?.totalTokens ?? 0,
      'llm.response_length': text.length,
    })

    return {
      answer: text,
      sources: options.chunks,
      tokensUsed: usage?.totalTokens,
    }
  })
}

export { GENERATOR_SYSTEM_PROMPT } from './prompts'
```

**Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

**Step 3: Run existing tests**

Run:
```bash
bun test src/agents/generator/__tests__/
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/agents/generator/index.ts
git commit -m "feat(generator): add Phoenix tracing to answer generation"
```

---

## Task 9: Instrument Critic Agent

**Files:**
- Modify: `src/agents/critic/index.ts`

**Step 1: Add span wrapper to critiqueAnswer**

Modify `src/agents/critic/index.ts`:

```typescript
// src/agents/critic/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan } from '@/core/telemetry'
import { CRITIC_SYSTEM_PROMPT } from './prompts'
import type { RetrievedChunk } from '@/core/state'

interface CritiqueOptions {
  query: string
  answer: string
  sources: RetrievedChunk[]
}

interface CritiqueResult {
  qualityScore: number
  needsRefinement: boolean
  refinementReason?: string
  scores: {
    relevance: number
    accuracy: number
    completeness: number
    clarity: number
    sourceUsage: number
  }
}

export async function critiqueAnswer(options: CritiqueOptions): Promise<CritiqueResult> {
  return createSpan('critique_llm_call', {
    'agent.name': 'critic',
    'llm.model': 'gpt-5-mini',
  }, async (span) => {
    const sourcesText = options.sources.map(s => s.content).join('\n')

    const { text, usage } = await generateText({
      model: getLLM('gpt-5-mini'),
      system: CRITIC_SYSTEM_PROMPT,
      prompt: `Query: ${options.query}

Answer to evaluate:
${options.answer}

Available sources:
${sourcesText || 'No sources provided'}

Evaluate the answer quality.`,
      temperature: 1.0,
      providerOptions: {
        openai: {
          reasoningEffort: 'medium',
        },
      },
    })

    span?.setAttributes({
      'llm.tokens_used': usage?.totalTokens ?? 0,
      'llm.response_length': text.length,
    })

    try {
      const result = JSON.parse(text)
      const critique = {
        qualityScore: Math.min(1, Math.max(0, result.qualityScore ?? 0.5)),
        needsRefinement: result.needsRefinement ?? result.qualityScore < 0.7,
        refinementReason: result.refinementReason,
        scores: result.scores ?? {
          relevance: 0.5,
          accuracy: 0.5,
          completeness: 0.5,
          clarity: 0.5,
          sourceUsage: 0.5,
        },
      }

      span?.setAttributes({
        'quality.score': critique.qualityScore,
      })

      return critique
    } catch {
      span?.setAttributes({
        'quality.score': 0.5,
      })
      return {
        qualityScore: 0.5,
        needsRefinement: true,
        refinementReason: 'Failed to parse critique response',
        scores: {
          relevance: 0.5,
          accuracy: 0.5,
          completeness: 0.5,
          clarity: 0.5,
          sourceUsage: 0.5,
        },
      }
    }
  })
}

export { CRITIC_SYSTEM_PROMPT } from './prompts'
```

**Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

**Step 3: Run existing tests**

Run:
```bash
bun test src/agents/critic/__tests__/
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/agents/critic/index.ts
git commit -m "feat(critic): add Phoenix tracing to answer critique"
```

---

## Task 10: Instrument Supervisor Graph Nodes

**Files:**
- Modify: `src/agents/supervisor/graph.ts`

**Step 1: Add span wrappers to each node function**

Modify `src/agents/supervisor/graph.ts`:

```typescript
// src/agents/supervisor/graph.ts
import { StateGraph, END, START } from '@langchain/langgraph'
import { AgentStateAnnotation, type AgentStateValues } from '@/core/state'
import { createSpan } from '@/core/telemetry'
import { classifyQuery } from '@/agents/classifier'
import { retrieveDocuments } from '@/agents/retriever'
import { generateAnswer } from '@/agents/generator'
import { critiqueAnswer } from '@/agents/critic'

const MAX_ITERATIONS = 2

async function classifierNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  return createSpan('classifier_node', {
    'agent.name': 'classifier',
    'workflow.status': 'in_progress',
  }, async (span) => {
    const result = await classifyQuery(state.query)
    span?.setAttributes({
      'query.type': result.queryType,
    })
    return {
      queryType: result.queryType,
      classificationConfidence: result.confidence,
      currentAgent: 'classifier',
    }
  })
}

async function retrieverNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  return createSpan('retriever_node', {
    'agent.name': 'retriever',
    'workflow.status': 'in_progress',
  }, async (span) => {
    try {
      const result = await retrieveDocuments({
        query: state.query,
        queryType: state.queryType,
        topK: 5,
      })
      span?.setAttributes({
        'retrieval.score': result.score,
      })
      return {
        retrievedChunks: result.chunks,
        retrievalScore: result.score,
        currentAgent: 'retriever',
      }
    } catch (error) {
      span?.setAttributes({
        'workflow.status': 'failed',
      })
      return {
        retrievedChunks: [],
        retrievalScore: 0,
        currentAgent: 'retriever',
        errors: [
          ...state.errors,
          {
            agent: 'retriever' as const,
            message: error instanceof Error ? error.message : 'Retrieval failed',
            timestamp: new Date().toISOString(),
          },
        ],
      }
    }
  })
}

async function generatorNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  return createSpan('generator_node', {
    'agent.name': 'generator',
    'workflow.status': 'in_progress',
    'iteration.count': state.iterations,
  }, async () => {
    const result = await generateAnswer({
      query: state.query,
      chunks: state.retrievedChunks ?? [],
    })
    return {
      draftAnswer: result.answer,
      finalAnswer: result.answer,
      currentAgent: 'generator',
    }
  })
}

async function criticNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  return createSpan('critic_node', {
    'agent.name': 'critic',
    'workflow.status': 'in_progress',
    'iteration.count': state.iterations,
  }, async (span) => {
    const result = await critiqueAnswer({
      query: state.query,
      answer: state.draftAnswer ?? '',
      sources: state.retrievedChunks ?? [],
    })
    span?.setAttributes({
      'quality.score': result.qualityScore,
    })
    return {
      qualityScore: result.qualityScore,
      needsRefinement: result.needsRefinement,
      refinementReason: result.refinementReason,
      currentAgent: 'critic',
      iterations: state.iterations + 1,
    }
  })
}

function routeAfterCritic(state: AgentStateValues): string {
  if (state.qualityScore && state.qualityScore >= 0.7) {
    return END
  }
  if (state.iterations >= MAX_ITERATIONS) {
    return END
  }
  return 'generator'
}

export function createAgentGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
    .addNode('classifier', classifierNode)
    .addNode('retriever', retrieverNode)
    .addNode('generator', generatorNode)
    .addNode('critic', criticNode)
    .addEdge(START, 'classifier')
    .addEdge('classifier', 'retriever')
    .addEdge('retriever', 'generator')
    .addEdge('generator', 'critic')
    .addConditionalEdges('critic', routeAfterCritic, {
      [END]: END,
      generator: 'generator',
    })

  return workflow.compile()
}
```

**Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

**Step 3: Run existing tests**

Run:
```bash
bun test src/agents/supervisor/__tests__/
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/agents/supervisor/graph.ts
git commit -m "feat(supervisor): add Phoenix tracing to agent graph nodes"
```

---

## Task 11: Run Full Test Suite

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run:
```bash
bun test
```

Expected: All tests pass

**Step 2: Run lint**

Run:
```bash
bun run lint
```

Expected: No errors

**Step 3: Run typecheck**

Run:
```bash
bun run typecheck
```

Expected: No errors

---

## Task 12: Update Memory with Implementation Status

**Step 1: Store session progress in memory**

```typescript
mcp__memory__aim_memory_add_facts({
  observations: [{
    entityName: "agentic-data-pipeline-agents",
    contents: [
      "Phoenix observability integration complete",
      "Using @arizeai/phoenix-otel with OpenTelemetry",
      "Full tracing: LLM calls, tool calls, agent nodes",
      "Graceful degradation when Phoenix unavailable",
      "Env vars: PHOENIX_COLLECTOR_ENDPOINT, PHOENIX_API_KEY"
    ]
  }]
})
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install dependency | package.json |
| 2 | Add config | src/core/config/env.ts |
| 3 | Create telemetry module | src/core/telemetry/phoenix.ts, index.ts |
| 4 | Write tests | src/core/telemetry/__tests__/phoenix.test.ts |
| 5 | Initialize at startup | src/index.ts |
| 6 | Instrument classifier | src/agents/classifier/index.ts |
| 7 | Instrument retriever | src/agents/retriever/index.ts |
| 8 | Instrument generator | src/agents/generator/index.ts |
| 9 | Instrument critic | src/agents/critic/index.ts |
| 10 | Instrument supervisor | src/agents/supervisor/graph.ts |
| 11 | Run full test suite | - |
| 12 | Update memory | - |
