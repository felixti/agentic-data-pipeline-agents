# API Authentication, OpenAPI Spec & Chat Assistant PRD Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add API key authentication, OpenAPI specification, and integration PRD for chat assistants.

**Architecture:** Single shared API key validated via X-API-Key header middleware. OpenAPI spec generated from Zod schemas, served dynamically and exported to static YAML. PRD targets internal developers and AI/LLM platforms with platform-agnostic approach.

**Tech Stack:** Zod, @asteasolutions/zod-to-openapi, Hono middleware

---

## Section 1: API Key Authentication

**Implementation:**
- Add `API_KEY` to environment variables (required in production, optional for dev)
- Create Hono middleware that checks `X-API-Key` header against env var
- Apply middleware to `/api/v1/*` routes (health endpoint remains public)
- Return `401 Unauthorized` with `{"error": "Invalid or missing API key"}` on failure

**Environment:**
```
API_KEY=your-secret-key-here
```

**Request example:**
```
POST /api/v1/chat
X-API-Key: your-secret-key-here
Content-Type: application/json

{"query": "What is LiteLLM?"}
```

---

## Section 2: OpenAPI Specification

**Implementation:**
- Add `zod` and `@asteasolutions/zod-to-openapi` dependencies
- Create `src/api/openapi.ts` with route definitions and schemas
- Add endpoints: `GET /openapi.json` and `GET /openapi.yaml`
- Create `scripts/generate-openapi.ts` to export static `openapi.yaml` to project root
- Add `bun run generate:openapi` script to `package.json`

**OpenAPI Info:**
```yaml
openapi: 3.1.0
info:
  title: Agentic Data Pipeline API
  version: 1.0.0
  description: Multi-agent RAG system for conversational Q&A
servers:
  - url: http://localhost:3000
    description: Local development
```

**Endpoints documented:**
- `GET /health` - Public health check
- `POST /api/v1/chat` - Submit query (requires X-API-Key)
- `POST /api/v1/chat/stream` - SSE streaming response (requires X-API-Key)

---

## Section 3: PRD for Chat Assistant Integration

**Document: `docs/prd-chat-assistant-integration.md`**

**Structure:**
1. **Overview** - What this API does, who it's for
2. **Authentication** - X-API-Key header usage, examples
3. **API Reference** - Quick reference table with endpoints, methods, auth requirements
4. **Integration Guide** - Step-by-step for internal developers (curl examples, TypeScript/JavaScript code samples)
5. **AI Platform Integration** - How to use OpenAPI spec for function calling
   - Import `openapi.yaml` into tools (Postman, Insomnia)
   - Generate client SDKs using OpenAPI generators
   - Use schema for AI function definitions (platform-agnostic approach)
6. **Error Handling** - Error codes and response formats
7. **Rate Limits & Best Practices** - Recommendations for production use

**Tone:** Technical, concise, code-first (minimal prose, maximum examples)

---

## Section 4: File Structure & Implementation Summary

**New files to create:**
```
src/
├── api/
│   ├── middleware/
│   │   └── auth.ts              # X-API-Key validation middleware
│   └── openapi.ts               # OpenAPI schema definitions
scripts/
└── generate-openapi.ts          # Static YAML export script
docs/
└── prd-chat-assistant-integration.md  # PRD document
openapi.yaml                     # Generated static spec (gitignored)
.env.example                     # Updated with API_KEY
```

**Files to modify:**
```
src/api/server.ts                # Add auth middleware, openapi routes
src/core/config/env.ts           # Add API_KEY to config
package.json                     # Add dependencies + generate:openapi script
```

**Dependencies to add:**
- `zod` - Schema validation
- `@asteasolutions/zod-to-openapi` - OpenAPI generation from Zod

**Test coverage:**
- Auth middleware tests (valid/missing/invalid key)
- OpenAPI endpoint tests (JSON/YAML responses)

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Key Scope | Single shared key | Simplest for internal/single-client use |
| Auth Header | X-API-Key | Matches RAG API pattern for consistency |
| OpenAPI Format | Both endpoint + static | Maximum flexibility for consumers |
| PRD Target | Internal devs + AI platforms | Covers both human and AI consumers |
| AI Integration | Platform-agnostic | OpenAPI as source of truth |
