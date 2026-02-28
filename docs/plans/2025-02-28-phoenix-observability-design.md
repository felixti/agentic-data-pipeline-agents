# Phoenix AI Observability Integration - Design Document

## Overview

Add Arize Phoenix as AI observability for the multi-agent RAG system using OpenTelemetry standard via `@arizeai/phoenix-otel` library.

## Requirements

- Full tracing of every LLM call, tool use, and agent node execution
- Registration at application startup in `src/index.ts`
- Optional with graceful degradation (app runs even if Phoenix is unavailable)
- Contextual span attributes for filtering and analysis
- Enabled in all environments (configurable via env vars)

## Architecture

### File Structure

```
src/
├── core/
│   ├── telemetry/
│   │   └── phoenix.ts        # Phoenix registration + span utilities
│   └── config/
│       └── env.ts            # Add telemetry config
├── index.ts                  # Calls initPhoenix() at startup
└── agents/
    ├── supervisor/graph.ts   # Root workflow span + node spans
    ├── classifier/index.ts   # Instrumented LLM calls
    ├── retriever/index.ts    # Instrumented tool calls
    ├── generator/index.ts    # Instrumented LLM calls
    └── critic/index.ts       # Instrumented LLM calls
```

### Trace Hierarchy

```
agent_workflow (root span)
├── classifier_node
│   └── classify_llm_call
├── retriever_node
│   └── retrieve_tool_call
├── generator_node
│   └── generate_llm_call
└── critic_node
    └── critique_llm_call
```

## Module Design

### Telemetry Module (`src/core/telemetry/phoenix.ts`)

**Exports:**
- `initPhoenix()` - Register with Phoenix at startup
- `createSpan(name, attributes, fn)` - Helper for creating spans
- `isPhoenixEnabled()` - Check if telemetry is active

**Configuration:**
```typescript
// Environment variables
PHOENIX_COLLECTOR_ENDPOINT  // e.g., https://phoenix.felixtek.cloud
PHOENIX_API_KEY             // Optional - graceful degradation if missing
```

**initPhoenix() behavior:**
- Calls `register()` from `@arizeai/phoenix-otel`
- Project name: `agentic-data-pipeline-agents`
- Catches errors, logs warning on failure
- Sets internal flag indicating Phoenix is enabled

**createSpan(name, attributes, fn) behavior:**
- Creates an active span with given name and attributes
- Executes provided async function within span context
- Records exceptions if function throws
- Returns result of the function
- Becomes no-op wrapper if Phoenix not enabled

**Span Attributes:**
| Attribute | Description |
|-----------|-------------|
| `agent.name` | Which agent (classifier, retriever, etc.) |
| `query.type` | Query classification |
| `retrieval.score` | Retrieval quality |
| `quality.score` | Critic's quality score |
| `iteration.count` | Current iteration number |
| `workflow.status` | In progress, completed, failed |
| `llm.model` | Model identifier |
| `llm.tokens_used` | Token count |
| `llm.response_length` | Response character count |
| `tool.name` | Tool identifier |
| `tool.result_count` | Number of results |

## Instrumentation Points

### Agent Graph (`src/agents/supervisor/graph.ts`)

1. **Root workflow span** wraps entire graph invocation
2. **Each node function** wrapped with span:
   - `classifier_node`
   - `retriever_node`
   - `generator_node`
   - `critic_node`
3. **Routing decisions** recorded as span attributes

### Generator Agent (`src/agents/generator/index.ts`)

```typescript
export async function generateAnswer(options: GenerateOptions): Promise<GenerateResult> {
  return createSpan('generate_llm_call', {
    'llm.model': 'gpt-4.1',
    'llm.chunk_count': options.chunks.length,
  }, async (span) => {
    const { text, usage } = await generateText({...})

    span?.setAttributes({
      'llm.tokens_used': usage?.totalTokens ?? 0,
      'llm.response_length': text.length,
    })

    return { answer: text, sources: options.chunks, tokensUsed: usage?.totalTokens }
  })
}
```

### Retriever Agent (`src/agents/retriever/index.ts`)

```typescript
export async function retrieveDocuments(options: RetrieveOptions): Promise<RetrieveResult> {
  return createSpan('retrieve_tool_call', {
    'tool.name': 'rag-api',
    'tool.query': options.query,
    'tool.top_k': options.topK,
  }, async (span) => {
    const result = await callRagApi(options)

    span?.setAttributes({
      'tool.result_count': result.chunks.length,
      'tool.score': result.score,
    })

    return result
  })
}
```

### Similar patterns for:
- `classifier/index.ts` - `classify_llm_call` span
- `critic/index.ts` - `critique_llm_call` span

## Configuration

### Environment Variables

Add to `src/core/config/env.ts`:

```typescript
interface Config {
  llm: { baseUrl: string; apiKey: string }
  rag: { apiUrl: string; apiKey: string }
  server: { port: number }
  telemetry: {
    phoenixEndpoint: string | undefined
    phoenixApiKey: string | undefined
  }
}
```

### Startup Integration

In `src/index.ts`:

```typescript
import { initPhoenix } from './core/telemetry/phoenix'
import app from './api/server'
import { config, validateEnv } from './core/config'

validateEnv()
initPhoenix()  // Graceful degradation handled internally

console.log(`Server running at http://localhost:${config.server.port}`)
// ...
```

## Error Handling

### Span Error Recording
- Exceptions in `createSpan()` recorded via `span.recordException(error)`
- Span status set to ERROR
- Original error re-thrown for normal error handling

### Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Missing endpoint | Log "Phoenix endpoint not configured, tracing disabled" |
| Registration failure | Log "Failed to register with Phoenix: {error}" |
| Runtime span creation | No-op if Phoenix disabled |

## Testing Strategy

### Unit Tests (`src/core/telemetry/__tests__/phoenix.test.ts`)

- `initPhoenix()` with/without env vars
- `createSpan()` executes function correctly
- Graceful degradation when Phoenix disabled
- Span attributes set correctly

### Integration Tests

- Verify spans created in agent workflow
- Mock Phoenix endpoint, verify traces sent
- App continues when Phoenix unreachable

## Dependencies

```json
{
  "dependencies": {
    "@arizeai/phoenix-otel": "^latest"
  }
}
```

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `PHOENIX_COLLECTOR_ENDPOINT` | No | Phoenix collector URL (e.g., https://phoenix.felixtek.cloud) |
| `PHOENIX_API_KEY` | No | Phoenix API key for authentication |
