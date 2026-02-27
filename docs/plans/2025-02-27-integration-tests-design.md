# Integration Tests Design

**Date:** 2025-02-27
**Status:** Approved
**Scope:** API layer + Workflow layer integration tests

## Overview

Comprehensive integration tests for the multi-agent RAG system, covering both the HTTP API layer and the LangGraph workflow orchestration. Tests use realistic fixtures for mock data and cover both happy paths and error scenarios.

## Test Structure

```
tests/
├── fixtures/
│   ├── llm-responses.ts       # Mock LLM responses (classifier, generator, critic)
│   ├── rag-responses.ts       # Mock RAG API responses
│   └── errors.ts              # Error scenario fixtures
├── integration/
│   ├── api/
│   │   ├── chat.test.ts       # POST /api/v1/chat endpoint
│   │   ├── stream.test.ts     # POST /api/v1/chat/stream SSE
│   │   └── errors.test.ts     # API error handling
│   └── workflow/
│       ├── happy-path.test.ts # Complete agent chain success
│       ├── refinement.test.ts # Quality fail → retry loop
│       ├── iterations.test.ts # Max iteration enforcement
│       └── errors.test.ts     # Agent chain error handling
└── setup.ts                   # (existing)
```

## Fixtures Design

### LLM Responses (`tests/fixtures/llm-responses.ts`)

```typescript
export const llmFixtures = {
  classifier: {
    factual: { queryType: 'factual', confidence: 0.95, reasoning: 'Direct fact query' },
    analytical: { queryType: 'analytical', confidence: 0.9, reasoning: 'Requires explanation' },
    vague: { queryType: 'vague', confidence: 0.6, reasoning: 'Unclear intent' },
  },
  generator: {
    success: 'Machine learning is a subset of AI that uses algorithms to learn from data [1][2].',
    withCitations: 'ML enables systems to improve through experience [1]. Key techniques include neural networks [2] and decision trees [3].',
  },
  critic: {
    pass: { qualityScore: 0.85, needsRefinement: false, scores: { relevance: 0.9, accuracy: 0.85, completeness: 0.8, clarity: 0.9, sourceUsage: 0.85 } },
    fail: { qualityScore: 0.5, needsRefinement: true, refinementReason: 'Incomplete answer', scores: { relevance: 0.6, accuracy: 0.5, completeness: 0.4, clarity: 0.6, sourceUsage: 0.5 } },
  },
}
```

### RAG Responses (`tests/fixtures/rag-responses.ts`)

```typescript
export const ragFixtures = {
  success: {
    results: [
      { chunk_id: '1', content: 'Machine learning is a subset of artificial intelligence.', hybrid_score: 0.95 },
      { chunk_id: '2', content: 'ML algorithms learn patterns from data.', hybrid_score: 0.88 },
    ],
    total: 2,
    query_time_ms: 45,
  },
  empty: { results: [], total: 0, query_time_ms: 10 },
}
```

### Error Fixtures (`tests/fixtures/errors.ts`)

```typescript
export const errorFixtures = {
  llmTimeout: new Error('LLM request timeout'),
  llmMalformed: 'Invalid JSON response',
  ragUnavailable: { ok: false, status: 503, statusText: 'Service Unavailable' },
}
```

## API Layer Tests

### Chat Endpoint (`tests/integration/api/chat.test.ts`)

| Test | Description |
|------|-------------|
| returns complete response with all fields | Mock all agents, call endpoint, assert status 200 + all response fields |
| returns 400 for missing query | POST with empty body, assert 400 + error message |

### Stream Endpoint (`tests/integration/api/stream.test.ts`)

| Test | Description |
|------|-------------|
| returns SSE events with correct format | Call stream, assert content-type, event types, final answer |

### API Errors (`tests/integration/api/errors.test.ts`)

| Test | Description |
|------|-------------|
| handles RAG API unavailable | Mock RAG 503, assert graceful error response |
| handles LLM timeout | Mock LLM timeout, assert appropriate error message |

## Workflow Layer Tests

### Happy Path (`tests/integration/workflow/happy-path.test.ts`)

| Test | Description |
|------|-------------|
| completes full agent chain successfully | Mock all pass, assert finalAnswer + qualityScore + iterations=1 |
| classifies and routes by query type | Test analytical query, assert correct retriever weights |

### Refinement Loop (`tests/integration/workflow/refinement.test.ts`)

| Test | Description |
|------|-------------|
| retries when quality score < 0.7 | Mock fail then pass, assert iterations=2 |
| stops retrying after quality passes | Mock pass first try, assert iterations=1 |

### Max Iterations (`tests/integration/workflow/iterations.test.ts`)

| Test | Description |
|------|-------------|
| stops after 2 iterations even if quality low | Mock always fail, assert iterations=2, returns best effort |

### Workflow Errors (`tests/integration/workflow/errors.test.ts`)

| Test | Description |
|------|-------------|
| accumulates errors in state | Mock agent failure, assert error in state.errors |
| handles malformed LLM response | Mock invalid JSON, assert graceful fallback |

## Mocking Strategy

### Helper Module (`tests/integration/helpers/mocks.ts`)

```typescript
import { mock } from 'bun:test'

// LLM mock - intercepts generateText from 'ai' module
export function mockLLM(responses: {
  classifier?: object
  generator?: string
  critic?: object
}) {
  // Returns mock.module() setup for 'ai' module
}

// RAG API mock - intercepts global.fetch
export function mockRAG(response: object | Error) {
  global.fetch = mock(() => {
    if (response instanceof Error) return Promise.reject(response)
    return Promise.resolve({ ok: true, json: () => Promise.resolve(response) })
  }) as unknown as typeof fetch
}

// Cleanup helper
export function restoreMocks() {
  mock.restore()
}
```

## Success Criteria

| Criteria | Target |
|----------|--------|
| Test files created | 7 test files + 3 fixture files + 1 helper |
| Test cases | ~15-20 total |
| All tests passing | 100% |
| Execution time | < 5 seconds for full suite |

## Files to Create

```
tests/fixtures/llm-responses.ts
tests/fixtures/rag-responses.ts
tests/fixtures/errors.ts
tests/integration/helpers/mocks.ts
tests/integration/api/chat.test.ts
tests/integration/api/stream.test.ts
tests/integration/api/errors.test.ts
tests/integration/workflow/happy-path.test.ts
tests/integration/workflow/refinement.test.ts
tests/integration/workflow/iterations.test.ts
tests/integration/workflow/errors.test.ts
```
