# Phoenix Sessions & AI SDK OTel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate AI SDK OpenTelemetry instrumentation with Phoenix sessions for comprehensive multi-turn conversation tracing.

**Architecture:** Layered context wrapping approach - API layer wraps requests with session context using `withSessionContext`, which propagates session.id to all child spans including AI SDK auto-generated LLM spans. Hybrid semantic conventions use OpenInference for common attributes and custom for domain-specific.

**Tech Stack:** @arizeai/openinference-core, @arizeai/openinference-semantic-conventions, @opentelemetry/api, Vercel AI SDK

---

## Task 1: Install OpenInference Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install the OpenInference packages**

Run:
```bash
bun add @arizeai/openinference-core @arizeai/openinference-semantic-conventions
```

**Step 2: Verify installation**

Run:
```bash
bun pm ls | grep openinference
```
Expected: Shows both `@arizeai/openinference-core` and `@arizeai/openinference-semantic-conventions`

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add openinference packages for session context"
```

---

## Task 2: Update SpanAttributes Interface

**Files:**
- Modify: `src/core/telemetry/phoenix.ts:51-70`

**Step 1: Add import for SemanticConventions**

At line 4, update imports:
```typescript
import { register } from '@arizeai/phoenix-otel'
import { config } from '../config'
import { context, trace, type Span } from '@opentelemetry/api'
import { setSession, getAttributesFromContext } from '@arizeai/openinference-core'
import { SemanticConventions } from '@arizeai/openinference-semantic-conventions'
```

**Step 2: Replace SpanAttributes interface (lines 51-70)**

```typescript
/**
 * Hybrid span attributes - OpenInference + custom domain attributes
 */
export interface SpanAttributes {
  // OpenInference semantic conventions (common)
  'session.id'?: string
  'user.id'?: string
  'llm.model_name'?: string
  'llm.token_count.total'?: number
  'llm.token_count.prompt'?: number
  'llm.token_count.completion'?: number
  'input.value'?: string
  'output.value'?: string
  'openinference.span.kind'?: 'agent' | 'chain' | 'llm' | 'tool' | 'retriever'

  // Custom domain-specific attributes
  'query.type'?: string
  'retrieval.score'?: number
  'quality.score'?: number
  'iteration.count'?: number
  'workflow.status'?: 'in_progress' | 'completed' | 'failed'
  'tool.name'?: string
  'tool.result_count'?: number
}
```

**Step 3: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/telemetry/phoenix.ts
git commit -m "feat(telemetry): add hybrid OpenInference span attributes"
```

---

## Task 3: Add withSessionContext Utility

**Files:**
- Modify: `src/core/telemetry/phoenix.ts`

**Step 1: Add withSessionContext function after getTracer (after line 49)**

```typescript
/**
 * Execute a function within session context.
 * All spans created within will automatically have session.id attribute.
 */
export async function withSessionContext<T>(
  sessionId: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!phoenixEnabled) {
    return fn()
  }
  return context.with(
    setSession(context.active(), { sessionId }),
    fn
  )
}
```

**Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/telemetry/phoenix.ts
git commit -m "feat(telemetry): add withSessionContext for session propagation"
```

---

## Task 4: Add createSessionSpan Utility

**Files:**
- Modify: `src/core/telemetry/phoenix.ts`

**Step 1: Add createSessionSpan function after withSessionContext**

```typescript
/**
 * Create a session-aware span for workflow-level operations.
 * Inherits session.id from context if set via withSessionContext.
 */
export async function createSessionSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span | null) => Promise<T>
): Promise<T> {
  if (!phoenixEnabled) {
    return fn(null)
  }

  const tracer = getTracer()
  return tracer.startActiveSpan(name, async (span) => {
    // Get session.id from context and apply to span
    const contextAttrs = getAttributesFromContext(context.active())
    for (const [key, value] of Object.entries(contextAttrs)) {
      if (value !== undefined) {
        span.setAttribute(key, value)
      }
    }

    // Set provided attributes
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

**Step 2: Export SemanticConventions constant**

Add at the end of the file:
```typescript
// Re-export for use in agents
export { SemanticConventions }
```

**Step 3: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/telemetry/phoenix.ts
git commit -m "feat(telemetry): add createSessionSpan for workflow spans"
```

---

## Task 5: Update Telemetry Barrel Exports

**Files:**
- Modify: `src/core/telemetry/index.ts`

**Step 1: Update exports**

Replace entire file:
```typescript
// src/core/telemetry/index.ts
export {
  initPhoenix,
  isPhoenixEnabled,
  createSpan,
  createSessionSpan,
  withSessionContext,
  SemanticConventions,
  type SpanAttributes
} from './phoenix'
```

**Step 2: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/telemetry/index.ts
git commit -m "feat(telemetry): export session utilities and SemanticConventions"
```

---

## Task 6: Add sessionId to State

**Files:**
- Modify: `src/core/state/types.ts`

**Step 1: Add sessionId to AgentStateValues interface (after query, line 28)**

```typescript
export interface AgentStateValues {
  query: string
  sessionId: string  // Add this
  conversationId?: string
  // ... rest unchanged
}
```

**Step 2: Add sessionId to AgentStateAnnotation (after query, line 46)**

```typescript
export const AgentStateAnnotation = Annotation.Root({
  query: Annotation<string>,
  sessionId: Annotation<string>,  // Add this
  conversationId: Annotation<string | undefined>,
  // ... rest unchanged
})
```

**Step 3: Update createInitialState function (lines 63-70)**

```typescript
export function createInitialState(query: string, sessionId: string, context?: ConversationContext): AgentStateValues {
  return {
    query,
    sessionId,
    context,
    iterations: 0,
    errors: [],
  }
}
```

**Step 4: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: Errors in chat.ts (expected - will fix in next task)

**Step 5: Commit**

```bash
git add src/core/state/types.ts
git commit -m "feat(state): add sessionId to agent state"
```

---

## Task 7: Update Chat Routes with Session Context

**Files:**
- Modify: `src/api/routes/chat.ts`

**Step 1: Add import for withSessionContext**

Update imports at top:
```typescript
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createAgentGraph } from '@/agents/supervisor'
import { withSessionContext } from '@/core/telemetry'
```

**Step 2: Add resolveSessionId helper after graph initialization**

```typescript
const chat = new Hono()
const graph = createAgentGraph()

/**
 * Get or generate session ID using hybrid approach.
 * Uses conversationId if provided, otherwise generates a new UUID.
 */
function resolveSessionId(conversationId?: string): string {
  return conversationId || crypto.randomUUID()
}
```

**Step 3: Update POST '/' handler (lines 9-40)**

```typescript
chat.post('/', async (c) => {
  const body = await c.req.json<{ query: string; conversationId?: string }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  const sessionId = resolveSessionId(body.conversationId)

  try {
    const result = await withSessionContext(sessionId, async () => {
      return graph.invoke({
        query: body.query,
        sessionId,
        conversationId: body.conversationId,
        iterations: 0,
        errors: [],
      })
    })

    return c.json({
      answer: result.finalAnswer,
      queryType: result.queryType,
      qualityScore: result.qualityScore,
      sources: result.retrievedChunks?.map((chunk) => ({
        chunkId: chunk.chunkId,
        content: chunk.content.substring(0, 200),
        score: chunk.score,
      })),
    })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})
```

**Step 4: Update POST '/stream' handler (lines 42-64)**

```typescript
chat.post('/stream', async (c) => {
  const body = await c.req.json<{ query: string; conversationId?: string }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  const sessionId = resolveSessionId(body.conversationId)

  return streamSSE(c, async (stream) => {
    await withSessionContext(sessionId, async () => {
      const eventStream = await graph.stream({
        query: body.query,
        sessionId,
        iterations: 0,
        errors: [],
      })

      for await (const event of eventStream) {
        await stream.writeSSE({
          data: JSON.stringify(event),
          event: 'agent_update',
          id: Date.now().toString(),
        })
      }
    })
  })
})
```

**Step 5: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 6: Commit**

```bash
git add src/api/routes/chat.ts
git commit -m "feat(api): wrap requests with session context"
```

---

## Task 8: Enable AI SDK OpenTelemetry

**Files:**
- Modify: `src/index.ts`

**Step 1: Add AI_SDK_OTEL_ENABLED before initPhoenix**

Update file:
```typescript
// src/index.ts
import { initPhoenix } from './core/telemetry'
import app from './api/server'
import { config, validateEnv } from './core/config'

// Enable AI SDK OpenTelemetry instrumentation
// Must be set before any AI SDK calls
process.env.AI_SDK_OTEL_ENABLED = 'true'

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

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: enable AI SDK OpenTelemetry instrumentation"
```

---

## Task 9: Update Generator Agent Attributes

**Files:**
- Modify: `src/agents/generator/index.ts`

**Step 1: Update imports**

```typescript
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan, SemanticConventions } from '@/core/telemetry'
import { GENERATOR_SYSTEM_PROMPT } from './prompts'
import type { RetrievedChunk } from '@/core/state'
```

**Step 2: Update createSpan call attributes (lines 21-25)**

```typescript
export async function generateAnswer(options: GenerateOptions): Promise<GenerateResult> {
  return createSpan('generate_llm_call', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'llm',
    'llm.model_name': 'gpt-4.1',
    'input.value': options.query.substring(0, 500),
    'llm.chunk_count': options.chunks.length,
  }, async (span) => {
```

**Step 3: Update span attributes after generateText (lines 43-46)**

```typescript
    span?.setAttributes({
      'llm.token_count.total': usage?.totalTokens ?? 0,
      'llm.token_count.prompt': usage?.promptTokens ?? 0,
      'llm.token_count.completion': usage?.completionTokens ?? 0,
      'output.value': text.substring(0, 500),
    })
```

**Step 4: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 5: Commit**

```bash
git add src/agents/generator/index.ts
git commit -m "feat(generator): update to hybrid semantic conventions"
```

---

## Task 10: Update Classifier Agent Attributes

**Files:**
- Modify: `src/agents/classifier/index.ts`

**Step 1: Update imports**

```typescript
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan, SemanticConventions } from '@/core/telemetry'
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts'
import type { QueryType } from '@/core/state'
```

**Step 2: Update createSpan call attributes (lines 15-18)**

```typescript
export async function classifyQuery(query: string): Promise<ClassificationResult> {
  return createSpan('classify_llm_call', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'llm',
    'llm.model_name': 'gpt-5-mini',
    'input.value': query.substring(0, 500),
  }, async (span) => {
```

**Step 3: Update span attributes after generateText (lines 31-34)**

```typescript
    span?.setAttributes({
      'llm.token_count.total': usage?.totalTokens ?? 0,
      'output.value': text.substring(0, 500),
    })
```

**Step 4: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 5: Commit**

```bash
git add src/agents/classifier/index.ts
git commit -m "feat(classifier): update to hybrid semantic conventions"
```

---

## Task 11: Update Retriever Agent Attributes

**Files:**
- Modify: `src/agents/retriever/index.ts`

**Step 1: Update imports**

```typescript
import { hybridSearch, type SearchResult } from '@/core/tools'
import { createSpan, SemanticConventions } from '@/core/telemetry'
import type { RetrievedChunk, QueryType } from '@/core/state'
import { RETRIEVER_SYSTEM_PROMPT } from './prompts'
```

**Step 2: Update createSpan call attributes (lines 22-27)**

```typescript
export async function retrieveDocuments(options: RetrieveOptions): Promise<RetrieveResult> {
  const topK = options.topK ?? 5

  return createSpan('retrieve_tool_call', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'retriever',
    'tool.name': 'rag-api',
    'input.value': options.query.substring(0, 500),
  }, async (span) => {
```

**Step 3: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/agents/retriever/index.ts
git commit -m "feat(retriever): update to hybrid semantic conventions"
```

---

## Task 12: Update Critic Agent Attributes

**Files:**
- Modify: `src/agents/critic/index.ts`

**Step 1: Update imports**

```typescript
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan, SemanticConventions } from '@/core/telemetry'
import { CRITIC_SYSTEM_PROMPT } from './prompts'
import type { RetrievedChunk } from '@/core/state'
```

**Step 2: Update createSpan call attributes (lines 28-31)**

```typescript
export async function critiqueAnswer(options: CritiqueOptions): Promise<CritiqueResult> {
  return createSpan('critique_llm_call', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'llm',
    'llm.model_name': 'gpt-5-mini',
    'input.value': options.query.substring(0, 500),
  }, async (span) => {
```

**Step 3: Update span attributes after generateText (lines 54-57)**

```typescript
    span?.setAttributes({
      'llm.token_count.total': usage?.totalTokens ?? 0,
      'output.value': text.substring(0, 500),
    })
```

**Step 4: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 5: Commit**

```bash
git add src/agents/critic/index.ts
git commit -m "feat(critic): update to hybrid semantic conventions"
```

---

## Task 13: Update Supervisor Graph with Session Span

**Files:**
- Modify: `src/agents/supervisor/graph.ts`

**Step 1: Update imports**

```typescript
import { StateGraph, END, START } from '@langchain/langgraph'
import { AgentStateAnnotation, type AgentStateValues } from '@/core/state'
import { createSpan, createSessionSpan, SemanticConventions } from '@/core/telemetry'
import { classifyQuery } from '@/agents/classifier'
import { retrieveDocuments } from '@/agents/retriever'
import { generateAnswer } from '@/agents/generator'
import { critiqueAnswer } from '@/agents/critic'
```

**Step 2: Update node spans to use SemanticConventions**

Update classifierNode (lines 12-28):
```typescript
async function classifierNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  return createSpan('classifier_node', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'chain',
    'workflow.status': 'in_progress',
  }, async (span) => {
    const result = await classifyQuery(state.query)
    span?.setAttributes({
      'query.type': result.queryType,
      'workflow.status': 'completed',
    })
    return {
      queryType: result.queryType,
      classificationConfidence: result.confidence,
      currentAgent: 'classifier',
    }
  })
}
```

Update retrieverNode (lines 30-69):
```typescript
async function retrieverNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  return createSpan('retriever_node', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'chain',
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
        'workflow.status': 'completed',
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
```

Update generatorNode (lines 71-90):
```typescript
async function generatorNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  return createSpan('generator_node', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'chain',
    'workflow.status': 'in_progress',
    'iteration.count': state.iterations,
  }, async (span) => {
    const result = await generateAnswer({
      query: state.query,
      chunks: state.retrievedChunks ?? [],
    })
    span?.setAttributes({
      'workflow.status': 'completed',
    })
    return {
      draftAnswer: result.answer,
      finalAnswer: result.answer,
      currentAgent: 'generator',
    }
  })
}
```

Update criticNode (lines 92-115):
```typescript
async function criticNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  return createSpan('critic_node', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'chain',
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
      'workflow.status': 'completed',
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
```

**Step 3: Run typecheck**

Run:
```bash
bun run typecheck
```
Expected: No errors

**Step 4: Commit**

```bash
git add src/agents/supervisor/graph.ts
git commit -m "feat(supervisor): update to hybrid semantic conventions"
```

---

## Task 14: Add Tests for Session Utilities

**Files:**
- Modify: `src/core/telemetry/__tests__/phoenix.test.ts`

**Step 1: Update imports**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createSpan, isPhoenixEnabled, initPhoenix, withSessionContext, createSessionSpan } from '../phoenix'
```

**Step 2: Add tests for withSessionContext after the initPhoenix describe block**

```typescript
  describe('withSessionContext', () => {
    test('executes function when Phoenix disabled', async () => {
      const result = await withSessionContext('test-session', async () => {
        return 'success'
      })
      expect(result).toBe('success')
    })

    test('passes through return value', async () => {
      const result = await withSessionContext('session-123', async () => {
        return { data: 'test' }
      })
      expect(result).toEqual({ data: 'test' })
    })

    test('propagates errors from wrapped function', async () => {
      expect(async () => {
        await withSessionContext('test-session', async () => {
          throw new Error('session error')
        })
      }).toThrow('session error')
    })
  })

  describe('createSessionSpan', () => {
    test('executes function when Phoenix disabled', async () => {
      const result = await createSessionSpan('test-span', {}, async () => {
        return 'test-result'
      })
      expect(result).toBe('test-result')
    })

    test('passes null span when Phoenix disabled', async () => {
      let receivedSpan: unknown = 'not-null'
      await createSessionSpan('test-span', {}, async (span) => {
        receivedSpan = span
        return 'done'
      })
      expect(receivedSpan).toBeNull()
    })

    test('propagates errors from wrapped function', async () => {
      expect(async () => {
        await createSessionSpan('test-span', {}, async () => {
          throw new Error('span error')
        })
      }).toThrow('span error')
    })
  })
```

**Step 3: Add tests for resolveSessionId (create new test file)**

Create: `src/api/routes/__tests__/chat.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'

describe('resolveSessionId', () => {
  function resolveSessionId(conversationId?: string): string {
    return conversationId || crypto.randomUUID()
  }

  test('returns conversationId when provided', () => {
    expect(resolveSessionId('conv-123')).toBe('conv-123')
  })

  test('generates UUID when conversationId not provided', () => {
    const id = resolveSessionId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('generates different UUIDs for each call', () => {
    const id1 = resolveSessionId()
    const id2 = resolveSessionId()
    expect(id1).not.toBe(id2)
  })

  test('returns empty string conversationId', () => {
    // Empty string is falsy, so should generate UUID
    const id = resolveSessionId('')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})
```

**Step 4: Run tests**

Run:
```bash
bun test src/core/telemetry/__tests__/phoenix.test.ts src/api/routes/__tests__/chat.test.ts
```
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/core/telemetry/__tests__/phoenix.test.ts src/api/routes/__tests__/chat.test.ts
git commit -m "test: add tests for session utilities"
```

---

## Task 15: Run Full Test Suite

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

**Step 4: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve test/lint/typecheck issues"
```

---

## Task 16: Manual Integration Test

**Files:**
- None (verification only)

**Step 1: Start the server**

Run:
```bash
bun run dev
```
Expected: Server starts, logs show Phoenix enabled

**Step 2: Test with conversationId**

Run:
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{"query": "What is LiteLLM?", "conversationId": "test-session-123"}'
```
Expected: JSON response with answer

**Step 3: Test without conversationId (auto-generated session)**

Run:
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{"query": "How does it work?"}'
```
Expected: JSON response with answer

**Step 4: Verify in Phoenix UI**

Open: https://phoenix.felixtek.cloud
Expected: See traces with session.id, AI SDK spans with detailed LLM info

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Install OpenInference dependencies |
| 2 | Update SpanAttributes interface |
| 3 | Add withSessionContext utility |
| 4 | Add createSessionSpan utility |
| 5 | Update telemetry exports |
| 6 | Add sessionId to state |
| 7 | Update chat routes with session context |
| 8 | Enable AI SDK OpenTelemetry |
| 9 | Update generator agent attributes |
| 10 | Update classifier agent attributes |
| 11 | Update retriever agent attributes |
| 12 | Update critic agent attributes |
| 13 | Update supervisor graph attributes |
| 14 | Add tests for session utilities |
| 15 | Run full test suite |
| 16 | Manual integration test |
