# Phoenix Sessions & AI SDK OpenTelemetry Integration - Design Document

## Overview

Integrate AI SDK OpenTelemetry instrumentation with Phoenix and setup Arize Phoenix sessions using `@arizeai/openinference-core` for session context propagation.

## Requirements

- Session ID propagation to all spans using OpenTelemetry context
- Hybrid session ID: use `conversationId` if provided, otherwise generate UUID
- AI SDK automatic OpenTelemetry instrumentation enabled
- Hybrid semantic conventions: OpenInference for common attributes, custom for domain-specific
- `withSessionContext` utility for wrapping operations with session context
- `createSessionSpan` for workflow-level spans that inherit session context

## Architecture

### Request Flow

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Chat Route (src/api/routes/chat.ts)                │
│  ┌───────────────────────────────────────────────┐  │
│  │  withSessionContext(sessionId, async () => {  │  │
│  │      graph.invoke({ query, sessionId, ... })  │  │
│  │  })                                           │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
    │
    ▼  (OpenTelemetry context propagates sessionId)
┌─────────────────────────────────────────────────────┐
│  Supervisor Graph (src/agents/supervisor/graph.ts) │
│  ┌───────────────────────────────────────────────┐  │
│  │  createSessionSpan('agent_workflow', {...})   │  │
│  │      ├── classifier_node (createSpan)         │  │
│  │      │       └── generateText (AI SDK auto)   │  │
│  │      ├── retriever_node (createSpan)          │  │
│  │      ├── generator_node (createSpan)          │  │
│  │      │       └── generateText (AI SDK auto)   │  │
│  │      └── critic_node (createSpan)             │  │
│  │              └── generateText (AI SDK auto)   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
    │
    ▼
Phoenix (https://phoenix.felixtek.cloud)
    - All spans have session.id attribute
    - AI SDK provides detailed LLM spans automatically
```

### Span Hierarchy in Phoenix

```
agent_workflow (createSessionSpan)
├── session.id = "abc-123"
├── classifier_node (createSpan)
│   ├── query.type = "factual"
│   └── generateText (AI SDK auto)  ← inherits session.id
│       ├── llm.model_name = "gpt-5-mini"
│       ├── llm.token_count.total = 150
│       └── input.value = "What is..."
├── retriever_node (createSpan)
│   └── retrieval.score = 0.85
├── generator_node (createSpan)
│   └── generateText (AI SDK auto)
│       └── llm.token_count.* = ...
└── critic_node (createSpan)
    ├── quality.score = 0.92
    └── generateText (AI SDK auto)
```

## Module Design

### Dependencies

Add to `package.json`:

```json
{
  "@arizeai/openinference-core": "^0.2.0",
  "@arizeai/openinference-semantic-conventions": "^0.2.0"
}
```

### Telemetry Module (`src/core/telemetry/phoenix.ts`)

**New Exports:**
- `withSessionContext(sessionId, fn)` - Execute function within session context
- `createSessionSpan(name, attributes, fn)` - Create span that inherits session from context
- `SemanticConventions` - Re-export for use in agents

**Hybrid Span Attributes:**

```typescript
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

**withSessionContext behavior:**
```typescript
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

**createSessionSpan behavior:**
- Inherits `session.id` from context (set by `withSessionContext`)
- Sets provided attributes on span
- Records exceptions if function throws
- Becomes no-op wrapper if Phoenix not enabled

### API Layer (`src/api/routes/chat.ts`)

**Session ID Resolution:**
```typescript
function resolveSessionId(conversationId?: string): string {
  return conversationId || crypto.randomUUID()
}
```

**Request Handling:**
```typescript
chat.post('/', async (c) => {
  const body = await c.req.json<{ query: string; conversationId?: string }>()
  const sessionId = resolveSessionId(body.conversationId)

  const result = await withSessionContext(sessionId, async () => {
    return graph.invoke({
      query: body.query,
      sessionId,
      iterations: 0,
      errors: [],
    })
  })
  // ...
})
```

### State Update (`src/core/state/index.ts`)

Add `sessionId` to state:

```typescript
export const AgentStateAnnotation = Annotation.Root({
  query: Annotation<string>,
  sessionId: Annotation<string>,  // New
  // ... rest unchanged
})
```

### AI SDK OpenTelemetry Setup (`src/index.ts`)

```typescript
// Enable AI SDK OpenTelemetry instrumentation
process.env.AI_SDK_OTEL_ENABLED = 'true'

validateEnv()
initPhoenix()
```

### Agent Attribute Updates

**Generator (`src/agents/generator/index.ts`):**
```typescript
return createSpan('generate_llm_call', {
  'openinference.span.kind': 'llm',
  'llm.model_name': 'gpt-4.1',
  'input.value': options.query.substring(0, 500),
}, async (span) => {
  // ...
  span?.setAttributes({
    'llm.token_count.total': usage?.totalTokens ?? 0,
    'llm.token_count.prompt': usage?.promptTokens ?? 0,
    'llm.token_count.completion': usage?.completionTokens ?? 0,
    'output.value': text.substring(0, 500),
  })
})
```

**Similar updates for classifier, retriever, critic agents.**

## Semantic Conventions Mapping

| Old Attribute | New Attribute | Source |
|--------------|---------------|--------|
| `llm.model` | `llm.model_name` | OpenInference |
| `llm.tokens_used` | `llm.token_count.total` | OpenInference |
| (new) | `llm.token_count.prompt` | OpenInference |
| (new) | `llm.token_count.completion` | OpenInference |
| (new) | `session.id` | OpenInference |
| (new) | `input.value` | OpenInference |
| (new) | `output.value` | OpenInference |
| (new) | `openinference.span.kind` | OpenInference |
| `query.type` | `query.type` | Custom (keep) |
| `retrieval.score` | `retrieval.score` | Custom (keep) |
| `quality.score` | `quality.score` | Custom (keep) |
| `iteration.count` | `iteration.count` | Custom (keep) |
| `workflow.status` | `workflow.status` | Custom (keep) |

## Testing Strategy

### Unit Tests

- `withSessionContext` with/without Phoenix enabled
- `createSessionSpan` inherits session from context
- `resolveSessionId` returns provided ID or generates UUID
- Span attributes set correctly

### Integration Tests

- Verify spans appear in Phoenix with correct session.id
- Verify AI SDK spans inherit session context
- Verify conversation continuity (same sessionId = same Phoenix session)

### Manual Verification

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is LiteLLM?", "conversationId": "test-conv-123"}'

# Check Phoenix UI for session "test-conv-123"
```

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add openinference-core, openinference-semantic-conventions |
| `src/core/telemetry/phoenix.ts` | Add withSessionContext, createSessionSpan, update SpanAttributes |
| `src/core/telemetry/index.ts` | Export new functions and SemanticConventions |
| `src/core/state/index.ts` | Add sessionId to AgentStateAnnotation |
| `src/api/routes/chat.ts` | Add resolveSessionId, wrap with withSessionContext |
| `src/index.ts` | Set AI_SDK_OTEL_ENABLED=true |
| `src/agents/generator/index.ts` | Update to hybrid semantic conventions |
| `src/agents/classifier/index.ts` | Update to hybrid semantic conventions |
| `src/agents/retriever/index.ts` | Update to hybrid semantic conventions |
| `src/agents/critic/index.ts` | Update to hybrid semantic conventions |
| `src/agents/supervisor/graph.ts` | Use createSessionSpan for workflow span |
| `src/core/telemetry/__tests__/phoenix.test.ts` | Add tests for new functionality |
