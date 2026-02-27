# Multi-Agent RAG System Design

**Date:** 2025-02-27
**Status:** Approved
**Architecture:** Hierarchical Supervisor Pattern

## Overview

Multi-agent RAG system using LangGraph.js for conversational Q&A. The system orchestrates multiple specialized agents to classify queries, retrieve relevant documents, generate answers, and refine responses for quality.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Language | TypeScript (latest supported by Bun) |
| Agent Framework | LangGraph.js |
| LLM SDK | @ai-sdk/openai-compatible |
| API Framework | Hono |
| Testing | Bun's built-in test runner |
| Linting/Formatting | Biome |
| Containerization | Docker + Docker Compose |

## Architecture

### Pattern: Hierarchical Supervisor

A supervisor agent coordinates specialist agents with conditional routing based on query classification and quality evaluation.

```
                    ┌─────────────────┐
                    │   START         │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Supervisor    │
                    │   (Router)      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │Classifier│  │Retriever │  │ Generator│
        │ Agent    │  │ Agent    │  │ Agent    │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │             │             │
             │      ┌──────┘             │
             │      │                    │
             ▼      ▼                    ▼
        ┌─────────────────────────────────┐
        │         Critic Agent            │
        │   (Quality Check & Refinement)  │
        └─────────────┬───────────────────┘
                      │
              ┌───────┴───────┐
              │               │
              ▼               ▼
        ┌──────────┐   ┌──────────┐
        │ Regenerate│   │   END    │
        │ (loop)    │   │          │
        └──────────┘   └──────────┘
```

### Agent Roles

1. **Supervisor Agent** - Routes queries and coordinates agent execution
2. **Classifier Agent** - Classifies query type (factual, analytical, comparative, vague, multi_hop)
3. **Retriever Agent** - Calls RAG API for document retrieval using hybrid search
4. **Generator Agent** - Produces answers with retrieved context
5. **Critic Agent** - Evaluates response quality and triggers refinement if needed

## Project Structure

```
agentic-data-pipeline-agents/
├── src/
│   ├── agents/                    # Agent modules (vertical slices)
│   │   ├── supervisor/
│   │   │   ├── index.ts           # Agent definition + graph
│   │   │   ├── tools.ts
│   │   │   ├── prompts.ts
│   │   │   └── __tests__/
│   │   ├── classifier/
│   │   │   ├── index.ts
│   │   │   ├── tools.ts
│   │   │   ├── prompts.ts
│   │   │   └── __tests__/
│   │   ├── retriever/
│   │   │   ├── index.ts
│   │   │   ├── tools.ts           # RAG API tools
│   │   │   ├── prompts.ts
│   │   │   └── __tests__/
│   │   ├── generator/
│   │   │   ├── index.ts
│   │   │   ├── tools.ts
│   │   │   ├── prompts.ts
│   │   │   └── __tests__/
│   │   └── critic/
│   │       ├── index.ts
│   │       ├── tools.ts
│   │       ├── prompts.ts
│   │       └── __tests__/
│   ├── core/                      # Shared core (horizontal)
│   │   ├── llm/
│   │   │   ├── index.ts
│   │   │   ├── provider.ts        # OpenAI-compatible client
│   │   │   └── __tests__/
│   │   ├── state/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── __tests__/
│   │   ├── tools/
│   │   │   ├── rag-api.ts
│   │   │   └── __tests__/
│   │   └── config/
│   │       ├── index.ts
│   │       └── env.ts
│   ├── api/
│   │   ├── routes/
│   │   │   ├── chat.ts
│   │   │   └── health.ts
│   │   ├── middleware/
│   │   └── server.ts
│   └── index.ts
├── tests/
│   ├── integration/
│   └── mocks/
├── docs/
│   └── plans/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── biome.json
├── bunfig.toml
└── CLAUDE.md
```

## State Definition

```typescript
interface AgentState {
  // Input
  query: string;
  conversationId?: string;
  context?: ConversationContext;

  // Classification
  queryType?: 'factual' | 'analytical' | 'comparative' | 'vague' | 'multi_hop';
  classificationConfidence?: number;

  // Retrieval
  retrievedChunks?: RetrievedChunk[];
  retrievalScore?: number;

  // Generation
  draftAnswer?: string;
  finalAnswer?: string;

  // Critic
  qualityScore?: number;
  needsRefinement?: boolean;
  refinementReason?: string;

  // Metadata
  currentAgent?: AgentName;
  iterations?: number;
  errors?: AgentError[];
}
```

## LLM Integration

Using `@ai-sdk/openai-compatible` for Azure AI Foundry compatibility:

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function createLLMProvider() {
  return createOpenAICompatible({
    baseURL: process.env.LLM_BASE_URL,
    name: 'azure-ai-foundry',
    headers: {
      'api-key': process.env.LLM_API_KEY,
    },
  });
}
```

Supported models: GPT-4o, GPT-4o-mini, DeepSeek, Kimi, and any OpenAI-compatible model.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/chat | Submit a query, get response |
| POST | /api/v1/chat/stream | Streaming response |
| GET | /health | Health check |

## RAG API Integration

The system integrates with the RAG Pipeline API at `https://pipeline-api.felixtek.cloud`:

- **Hybrid Search:** `/api/v1/search/hybrid` - Combines vector + text search
- **Semantic Search:** `/api/v1/search/semantic/text` - Vector similarity search
- **Text Search:** `/api/v1/search/text` - Full-text search with BM25
- **RAG Query:** `/api/v1/rag/query` - Full RAG pipeline with strategy presets

## Testing Strategy

- **Unit Tests:** Bun's built-in test runner (Jest-compatible API)
- **Parallel Execution:** Tests run in parallel by default
- **Coverage:** Built-in coverage reporting
- **Mocking:** Mock LLM responses for deterministic tests

## Containerization

```dockerfile
FROM oven/bun:1 AS base
# Multi-stage build for optimized production image
```

```yaml
# docker-compose.yml
services:
  agent-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - LLM_BASE_URL=${LLM_BASE_URL}
      - LLM_API_KEY=${LLM_API_KEY}
      - RAG_API_URL=https://pipeline-api.felixtek.cloud
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| LLM_BASE_URL | Azure AI Foundry endpoint | - |
| LLM_API_KEY | API key for LLM | - |
| RAG_API_URL | RAG pipeline API URL | https://pipeline-api.felixtek.cloud |
| PORT | Server port | 3000 |

## Session Memory Instructions

### Start of Every Session

1. Use memory tools to recall project context:
   - `mcp__memory__aim_memory_search({ query: "agentic-data-pipeline-agents" })`
   - `mcp__memory__aim_memory_get({ names: ["project_context", "current_state"] })`
2. Review CLAUDE.md and any recent changes
3. Check docs/plans/ for implementation plans

### End of Every Session

1. Store session progress using memory tools:
   - `mcp__memory__aim_memory_store` or `mcp__memory__aim_memory_add_facts`
   - Store: completed tasks, decisions made, blockers, next steps
2. Update CLAUDE.md if architecture or commands changed

## Success Criteria

- [ ] All 5 agents implemented with LangGraph.js
- [ ] Query classification accuracy > 80%
- [ ] Response generation with source attribution
- [ ] Quality score threshold enforcement (< 0.7 triggers refinement)
- [ ] API endpoints functional with streaming support
- [ ] Unit test coverage > 80%
- [ ] Containerized and runnable via docker-compose
- [ ] GitHub repository created via gh CLI
