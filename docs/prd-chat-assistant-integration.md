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
