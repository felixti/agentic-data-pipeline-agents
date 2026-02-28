# API Authentication, OpenAPI Spec & Chat Assistant PRD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add API key authentication, OpenAPI specification, and integration PRD for chat assistants.

**Architecture:** Single shared API key validated via X-API-Key header middleware. OpenAPI spec generated from Zod schemas, served dynamically and exported to static YAML. PRD targets internal developers and AI/LLM platforms with platform-agnostic approach.

**Tech Stack:** Zod (already installed), @asteasolutions/zod-to-openapi, Hono middleware

---

## Task 1: Add API_KEY to Environment Config

**Files:**
- Modify: `src/core/config/env.ts`
- Modify: `.env.example`
- Test: `src/core/config/__tests__/env.test.ts`

**Step 1: Write the failing test**

Create `src/core/config/__tests__/env.test.ts`:

```typescript
// src/core/config/__tests__/env.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { getEnv } from '../env'

describe('Environment Config', () => {
  test('getEnv returns undefined for missing variable without default', () => {
    const value = getEnv('NONEXISTENT_VAR_XYZ')
    expect(value).toBeUndefined()
  })

  test('getEnv returns default value for missing variable', () => {
    const value = getEnv('NONEXISTENT_VAR_XYZ', 'default_value')
    expect(value).toBe('default_value')
  })

  test('getEnv returns actual value when set', () => {
    process.env.TEST_VAR = 'test_value'
    const value = getEnv('TEST_VAR', 'default')
    expect(value).toBe('test_value')
    delete process.env.TEST_VAR
  })
})
```

**Step 2: Run test to verify it passes**

Run: `bun test src/core/config/__tests__/env.test.ts`
Expected: All tests PASS (getEnv already exists)

**Step 3: Update .env.example with API_KEY**

Modify `.env.example`:

```
LLM_BASE_URL=https://your-ai-foundry.openai.azure.com
LLM_API_KEY=your-api-key
RAG_API_URL=https://pipeline-api.felixtek.cloud
RAG_API_KEY=your-rag-api-key
API_KEY=your-api-key-here
PORT=3000
```

**Step 4: Commit**

```bash
git add .env.example src/core/config/__tests__/env.test.ts
git commit -m "chore: add API_KEY to env example and config tests"
```

---

## Task 2: Create Auth Middleware

**Files:**
- Create: `src/api/middleware/auth.ts`
- Create: `src/api/middleware/__tests__/auth.test.ts`

**Step 1: Write the failing test**

Create `src/api/middleware/__tests__/auth.test.ts`:

```typescript
// src/api/middleware/__tests__/auth.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { apiKeyAuth } from '../auth'

describe('API Key Auth Middleware', () => {
  const originalEnv = process.env.API_KEY

  beforeEach(() => {
    process.env.API_KEY = 'test-secret-key'
  })

  afterEach(() => {
    if (originalEnv) {
      process.env.API_KEY = originalEnv
    } else {
      delete process.env.API_KEY
    }
  })

  test('allows request with valid X-API-Key header', async () => {
    const app = new Hono()
    app.use('*', apiKeyAuth)
    app.get('/protected', (c) => c.json({ success: true }))

    const res = await app.request('/protected', {
      headers: { 'X-API-Key': 'test-secret-key' },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  test('rejects request with missing X-API-Key header', async () => {
    const app = new Hono()
    app.use('*', apiKeyAuth)
    app.get('/protected', (c) => c.json({ success: true }))

    const res = await app.request('/protected')

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid or missing API key')
  })

  test('rejects request with invalid X-API-Key header', async () => {
    const app = new Hono()
    app.use('*', apiKeyAuth)
    app.get('/protected', (c) => c.json({ success: true }))

    const res = await app.request('/protected', {
      headers: { 'X-API-Key': 'wrong-key' },
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid or missing API key')
  })

  test('allows all requests when API_KEY is not set', async () => {
    delete process.env.API_KEY

    const app = new Hono()
    app.use('*', apiKeyAuth)
    app.get('/protected', (c) => c.json({ success: true }))

    const res = await app.request('/protected')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test src/api/middleware/__tests__/auth.test.ts`
Expected: FAIL with "Cannot find module '../auth'"

**Step 3: Write minimal implementation**

Create `src/api/middleware/auth.ts`:

```typescript
// src/api/middleware/auth.ts
import type { Context, Next } from 'hono'

export async function apiKeyAuth(c: Context, next: Next) {
  const configuredKey = process.env.API_KEY

  // If no API_KEY is configured, allow all requests (dev mode)
  if (!configuredKey) {
    return next()
  }

  const providedKey = c.req.header('X-API-Key')

  if (!providedKey || providedKey !== configuredKey) {
    return c.json({ error: 'Invalid or missing API key' }, 401)
  }

  return next()
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/api/middleware/__tests__/auth.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/api/middleware/auth.ts src/api/middleware/__tests__/auth.test.ts
git commit -m "feat: add API key authentication middleware"
```

---

## Task 3: Apply Auth Middleware to API Routes

**Files:**
- Modify: `src/api/server.ts`
- Modify: `src/api/__tests__/server.test.ts`

**Step 1: Write the failing test**

Modify `src/api/__tests__/server.test.ts` to add auth tests:

```typescript
// src/api/__tests__/server.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import app from '../server'

describe('API Server', () => {
  const originalApiKey = process.env.API_KEY

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key'
  })

  afterEach(() => {
    if (originalApiKey) {
      process.env.API_KEY = originalApiKey
    } else {
      delete process.env.API_KEY
    }
  })

  test('GET /health returns 200 (no auth required)', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('healthy')
  })

  test('POST /api/v1/chat requires query', async () => {
    const res = await app.request('/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/v1/chat rejects missing API key', async () => {
    const res = await app.request('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  test('POST /api/v1/chat rejects invalid API key', async () => {
    const res = await app.request('/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'wrong-key',
      },
      body: JSON.stringify({ query: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  test('POST /api/v1/chat/stream rejects missing API key', async () => {
    const res = await app.request('/api/v1/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    })
    expect(res.status).toBe(401)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test src/api/__tests__/server.test.ts`
Expected: FAIL - auth tests fail because middleware not applied

**Step 3: Apply middleware to server**

Modify `src/api/server.ts`:

```typescript
// src/api/server.ts
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { errorHandler } from './middleware/error'
import { apiKeyAuth } from './middleware/auth'
import health from './routes/health'
import chat from './routes/chat'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())
app.use('*', errorHandler)

// Health check is public (no auth)
app.route('/health', health)

// API routes require authentication
app.use('/api/v1/*', apiKeyAuth)
app.route('/api/v1/chat', chat)

export default app
```

**Step 4: Run test to verify it passes**

Run: `bun test src/api/__tests__/server.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/api/server.ts src/api/__tests__/server.test.ts
git commit -m "feat: apply API key auth to /api/v1/* routes"
```

---

## Task 4: Install OpenAPI Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install dependencies**

Run: `bun add @asteasolutions/zod-to-openapi yaml`

**Step 2: Verify installation**

Run: `bun test`
Expected: All existing tests still PASS

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @asteasolutions/zod-to-openapi and yaml deps"
```

---

## Task 5: Create OpenAPI Schema Definitions

**Files:**
- Create: `src/api/openapi.ts`
- Create: `src/api/__tests__/openapi.test.ts`

**Step 1: Write the failing test**

Create `src/api/__tests__/openapi.test.ts`:

```typescript
// src/api/__tests__/openapi.test.ts
import { describe, test, expect } from 'bun:test'
import { registry } from '../openapi'

describe('OpenAPI Registry', () => {
  test('registry has correct info', () => {
    const document = registry.generateOpenApiDocument()
    expect(document.info.title).toBe('Agentic Data Pipeline API')
    expect(document.info.version).toBe('1.0.0')
  })

  test('registry has health endpoint', () => {
    const document = registry.generateOpenApiDocument()
    expect(document.paths['/health']).toBeDefined()
    expect(document.paths['/health'].get).toBeDefined()
  })

  test('registry has chat endpoint with security', () => {
    const document = registry.generateOpenApiDocument()
    expect(document.paths['/api/v1/chat']).toBeDefined()
    expect(document.paths['/api/v1/chat'].post).toBeDefined()
    expect(document.paths['/api/v1/chat'].post.security).toEqual([{ ApiKeyAuth: [] }])
  })

  test('registry has chat stream endpoint', () => {
    const document = registry.generateOpenApiDocument()
    expect(document.paths['/api/v1/chat/stream']).toBeDefined()
    expect(document.paths['/api/v1/chat/stream'].post).toBeDefined()
  })

  test('registry has ApiKeyAuth security scheme', () => {
    const document = registry.generateOpenApiDocument()
    expect(document.components?.securitySchemes?.ApiKeyAuth).toEqual({
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test src/api/__tests__/openapi.test.ts`
Expected: FAIL with "Cannot find module '../openapi'"

**Step 3: Write minimal implementation**

Create `src/api/openapi.ts`:

```typescript
// src/api/openapi.ts
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

// Security scheme
const ApiKeyAuth = registry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
})

// Schemas
const HealthResponseSchema = registry.register(
  'HealthResponse',
  z.object({
    status: z.string().openapi({ example: 'healthy' }),
  })
)

const ChatRequestSchema = registry.register(
  'ChatRequest',
  z.object({
    query: z.string().openapi({ example: 'What is LiteLLM?' }),
    conversationId: z.string().optional().openapi({ example: 'conv-123' }),
  })
)

const SourceSchema = registry.register(
  'Source',
  z.object({
    chunkId: z.string().openapi({ example: 'chunk-abc' }),
    content: z.string().openapi({ example: 'LiteLLM is a proxy...' }),
    score: z.number().openapi({ example: 0.95 }),
  })
)

const ChatResponseSchema = registry.register(
  'ChatResponse',
  z.object({
    answer: z.string().openapi({ example: 'LiteLLM is a lightweight LLM proxy...' }),
    queryType: z.string().optional().openapi({ example: 'factual' }),
    qualityScore: z.number().optional().openapi({ example: 0.85 }),
    sources: z.array(SourceSchema).optional(),
  })
)

const ErrorResponseSchema = registry.register(
  'ErrorResponse',
  z.object({
    error: z.string().openapi({ example: 'Invalid or missing API key' }),
  })
)

// Routes
registry.registerPath({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  tags: ['Health'],
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/chat',
  summary: 'Submit a query to the agent system',
  tags: ['Chat'],
  security: [{ [ApiKeyAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: ChatResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/chat/stream',
  summary: 'Submit a query with SSE streaming response',
  tags: ['Chat'],
  security: [{ [ApiKeyAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'SSE stream of agent events',
      content: {
        'text/event-stream': {
          schema: z.object({
            event: z.string(),
            data: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

export function generateOpenApiDocument() {
  return registry.generateOpenApiDocument({
    openapi: '3.1.0',
    info: {
      title: 'Agentic Data Pipeline API',
      version: '1.0.0',
      description: 'Multi-agent RAG system for conversational Q&A',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development',
      },
    ],
  })
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/api/__tests__/openapi.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/api/openapi.ts src/api/__tests__/openapi.test.ts
git commit -m "feat: add OpenAPI schema definitions with Zod"
```

---

## Task 6: Add OpenAPI Endpoints to Server

**Files:**
- Modify: `src/api/server.ts`
- Modify: `src/api/__tests__/server.test.ts`

**Step 1: Write the failing test**

Add to `src/api/__tests__/server.test.ts`:

```typescript
// Add to existing describe block in src/api/__tests__/server.test.ts

  test('GET /openapi.json returns OpenAPI spec', async () => {
    const res = await app.request('/openapi.json')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { openapi: string; info: { title: string } }
    expect(body.openapi).toBe('3.1.0')
    expect(body.info.title).toBe('Agentic Data Pipeline API')
  })

  test('GET /openapi.yaml returns YAML OpenAPI spec', async () => {
    const res = await app.request('/openapi.yaml')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/yaml')
    const text = await res.text()
    expect(text).toContain('openapi: 3.1.0')
    expect(text).toContain('title: Agentic Data Pipeline API')
  })
```

**Step 2: Run test to verify it fails**

Run: `bun test src/api/__tests__/server.test.ts`
Expected: FAIL - 404 on /openapi.json and /openapi.yaml

**Step 3: Add OpenAPI routes to server**

Modify `src/api/server.ts`:

```typescript
// src/api/server.ts
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { errorHandler } from './middleware/error'
import { apiKeyAuth } from './middleware/auth'
import health from './routes/health'
import chat from './routes/chat'
import { generateOpenApiDocument } from './openapi'
import yaml from 'yaml'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())
app.use('*', errorHandler)

// OpenAPI endpoints (public)
app.get('/openapi.json', (c) => {
  return c.json(generateOpenApiDocument())
})

app.get('/openapi.yaml', (c) => {
  const doc = generateOpenApiDocument()
  return c.text(yaml.stringify(doc), 200, {
    'Content-Type': 'text/yaml',
  })
})

// Health check is public (no auth)
app.route('/health', health)

// API routes require authentication
app.use('/api/v1/*', apiKeyAuth)
app.route('/api/v1/chat', chat)

export default app
```

**Step 4: Run test to verify it passes**

Run: `bun test src/api/__tests__/server.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/api/server.ts src/api/__tests__/server.test.ts
git commit -m "feat: add /openapi.json and /openapi.yaml endpoints"
```

---

## Task 7: Create Static OpenAPI Generation Script

**Files:**
- Create: `scripts/generate-openapi.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Step 1: Create the generation script**

Create `scripts/generate-openapi.ts`:

```typescript
// scripts/generate-openapi.ts
import { writeFileSync } from 'fs'
import { join } from 'path'
import yaml from 'yaml'
import { generateOpenApiDocument } from '../src/api/openapi'

const outputPath = join(process.cwd(), 'openapi.yaml')

try {
  const doc = generateOpenApiDocument()
  const yamlContent = yaml.stringify(doc)
  writeFileSync(outputPath, yamlContent, 'utf-8')
  console.log(`OpenAPI spec written to ${outputPath}`)
} catch (error) {
  console.error('Failed to generate OpenAPI spec:', error)
  process.exit(1)
}
```

**Step 2: Add script to package.json**

Modify `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun run dist/index.js",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "lint": "biome check src tests",
    "format": "biome format --write src tests",
    "typecheck": "tsc --noEmit",
    "generate:openapi": "bun run scripts/generate-openapi.ts"
  }
}
```

**Step 3: Add openapi.yaml to .gitignore**

Add to `.gitignore`:

```
# Generated files
openapi.yaml
```

**Step 4: Run the script to verify**

Run: `bun run generate:openapi`
Expected: Creates `openapi.yaml` in project root

**Step 5: Verify generated file**

Run: `head -20 openapi.yaml`
Expected: Shows OpenAPI YAML content with title and version

**Step 6: Commit**

```bash
git add scripts/generate-openapi.ts package.json .gitignore
git commit -m "feat: add generate:openapi script for static YAML export"
```

---

## Task 8: Create PRD for Chat Assistant Integration

**Files:**
- Create: `docs/prd-chat-assistant-integration.md`

**Step 1: Create the PRD document**

Create `docs/prd-chat-assistant-integration.md`:

```markdown
# Agentic Data Pipeline API - Integration Guide

Multi-agent RAG system for conversational Q&A.

## Overview

This API provides intelligent question-answering through a multi-agent system:

1. **Classifier** - Determines query type (factual, analytical, etc.)
2. **Retriever** - Fetches relevant documents from RAG knowledge base
3. **Generator** - Produces answers with retrieved context
4. **Critic** - Evaluates quality and triggers refinement if needed

**Target audience:** Internal developers and AI/LLM platforms.

---

## Authentication

All `/api/v1/*` endpoints require an API key via the `X-API-Key` header.

```bash
X-API-Key: your-api-key-here
```

Get your API key from the team. The health check and OpenAPI endpoints are public.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /health | No | Health check |
| POST | /api/v1/chat | Yes | Submit query, get response |
| POST | /api/v1/chat/stream | Yes | Submit query, get SSE stream |
| GET | /openapi.json | No | OpenAPI spec (JSON) |
| GET | /openapi.yaml | No | OpenAPI spec (YAML) |

---

## Integration Guide

### cURL Example

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"query": "What is LiteLLM?"}'
```

### TypeScript/JavaScript

```typescript
const response = await fetch('http://localhost:3000/api/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key',
  },
  body: JSON.stringify({
    query: 'What is LiteLLM?',
  }),
})

const data = await response.json()
console.log(data.answer)
```

### Streaming (SSE)

```typescript
const response = await fetch('http://localhost:3000/api/v1/chat/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key',
  },
  body: JSON.stringify({ query: 'What is LiteLLM?' }),
})

const reader = response.body?.getReader()
const decoder = new TextDecoder()

while (reader) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value)
  // Parse SSE events from chunk
  console.log(chunk)
}
```

---

## AI Platform Integration

### Using OpenAPI Spec

The OpenAPI spec is the source of truth for integration:

1. **Import to API tools** - Load `openapi.yaml` into Postman, Insomnia, or Bruno
2. **Generate SDKs** - Use [OpenAPI Generator](https://openapi-generator.tech/) for client libraries
3. **Function calling** - Derive function schemas from the spec for AI assistants

### Function Schema Example (from OpenAPI)

```json
{
  "name": "submit_query",
  "description": "Submit a query to the multi-agent RAG system",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The question to answer"
      },
      "conversationId": {
        "type": "string",
        "description": "Optional conversation ID for context"
      }
    },
    "required": ["query"]
  }
}
```

### Integration Checklist

- [ ] Obtain API key from team
- [ ] Import `openapi.yaml` to your API client
- [ ] Test health endpoint: `GET /health`
- [ ] Test query: `POST /api/v1/chat`
- [ ] Handle 401 errors (invalid/missing key)
- [ ] Handle 400 errors (missing query)
- [ ] Handle 500 errors (server issues)

---

## Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `Query is required` | Missing `query` in request body |
| 401 | `Invalid or missing API key` | Missing or wrong `X-API-Key` header |
| 500 | `Internal server error` | Server-side error (check logs) |

### Error Response Format

```json
{
  "error": "Description of the error"
}
```

---

## Response Format

### Chat Response

```json
{
  "answer": "LiteLLM is a lightweight LLM proxy...",
  "queryType": "factual",
  "qualityScore": 0.85,
  "sources": [
    {
      "chunkId": "chunk-abc",
      "content": "LiteLLM is a proxy...",
      "score": 0.95
    }
  ]
}
```

### Streaming Events

SSE events are JSON objects with agent update data:

```
event: agent_update
data: {"node":"classifier","result":{"type":"factual"}}
data: {"node":"retriever","result":{"chunks":[...]}}
data: {"node":"generator","result":{"answer":"..."}}
```

---

## Best Practices

1. **Handle errors gracefully** - Show user-friendly messages for 401/500 errors
2. **Use streaming for long queries** - Better UX for complex questions
3. **Cache responses** - Same query returns same answer (no built-in caching)
4. **Set timeouts** - Complex queries may take 10-30 seconds
5. **Log conversationId** - Useful for debugging multi-turn conversations

---

## Support

- OpenAPI spec: `GET /openapi.json` or `GET /openapi.yaml`
- Issues: Contact the team or check server logs
```

**Step 2: Commit**

```bash
git add docs/prd-chat-assistant-integration.md
git commit -m "docs: add PRD for chat assistant integration"
```

---

## Task 9: Update HTTP Request Files

**Files:**
- Modify: `http/chat.http`
- Modify: `http/stream.http`
- Modify: `http/http-client.env.json`

**Step 1: Update http-client.env.json**

Modify `http/http-client.env.json`:

```json
{
  "dev": {
    "baseUrl": "http://localhost:3000",
    "apiKey": "your-api-key-here"
  }
}
```

**Step 2: Update http/chat.http**

Modify `http/chat.http`:

```http
### Chat - Basic Query
POST {{baseUrl}}/api/v1/chat
Content-Type: application/json
X-API-Key: {{apiKey}}

{
  "query": "What is LiteLLM?"
}

### Chat - With Conversation ID
POST {{baseUrl}}/api/v1/chat
Content-Type: application/json
X-API-Key: {{apiKey}}

{
  "query": "Tell me more about it",
  "conversationId": "conv-123"
}

### Chat - Missing Query (400 Error)
POST {{baseUrl}}/api/v1/chat
Content-Type: application/json
X-API-Key: {{apiKey}}

{}

### Chat - Missing API Key (401 Error)
POST {{baseUrl}}/api/v1/chat
Content-Type: application/json

{
  "query": "What is LiteLLM?"
}
```

**Step 3: Update http/stream.http**

Modify `http/stream.http`:

```http
### Stream - Basic Query
POST {{baseUrl}}/api/v1/chat/stream
Content-Type: application/json
X-API-Key: {{apiKey}}

{
  "query": "What is LiteLLM?"
}

### Stream - Missing API Key (401 Error)
POST {{baseUrl}}/api/v1/chat/stream
Content-Type: application/json

{
  "query": "What is LiteLLM?"
}
```

**Step 4: Commit**

```bash
git add http/
git commit -m "feat: update HTTP files with X-API-Key authentication"
```

---

## Task 10: Final Verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 2: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 3: Run type check**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Manual smoke test**

Start server:
```bash
bun run dev
```

Test health (no auth):
```bash
curl http://localhost:3000/health
# Expected: {"status":"healthy"}
```

Test OpenAPI (no auth):
```bash
curl http://localhost:3000/openapi.json | head -20
# Expected: OpenAPI JSON spec
```

Test chat without auth (should fail):
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
# Expected: {"error":"Invalid or missing API key"}
```

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: final verification and cleanup"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | env.ts, .env.example | Add API_KEY config |
| 2 | auth.ts | Create auth middleware |
| 3 | server.ts | Apply auth to routes |
| 4 | package.json | Install OpenAPI deps |
| 5 | openapi.ts | Create schema definitions |
| 6 | server.ts | Add OpenAPI endpoints |
| 7 | scripts/ | Static YAML generation |
| 8 | docs/ | PRD document |
| 9 | http/ | Update HTTP files |
| 10 | - | Final verification |
