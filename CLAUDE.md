# Agentic Data Pipeline - Multi-Agent RAG System

## Project Overview

Multi-agent RAG system using LangGraph.js for conversational Q&A. Built with Bun, TypeScript, vertical slice architecture, and modular monolith pattern.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Language | TypeScript |
| Agent Framework | LangGraph.js |
| LLM SDK | @ai-sdk/openai-compatible |
| API Framework | Hono |
| Testing | Bun test runner |
| Linting/Formatting | Biome |
| Containerization | Docker + Docker Compose |

## Project Structure

```
src/
├── agents/          # Vertical slice per agent
│   ├── supervisor/  # Orchestrates agent flow
│   ├── classifier/  # Query classification
│   ├── retriever/   # Document retrieval
│   ├── generator/   # Answer generation
│   └── critic/      # Quality evaluation
├── core/            # Shared utilities
│   ├── config/      # Environment configuration
│   ├── llm/         # LLM provider abstraction
│   ├── state/       # LangGraph state types
│   └── tools/       # RAG API tools
├── api/             # HTTP API layer
│   ├── routes/      # Chat and health endpoints
│   └── middleware/  # Error handling
└── index.ts         # Entry point
```

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start development server
bun run build        # Build for production
bun test             # Run tests (parallel)
bun run lint         # Run Biome linter
bun run format       # Format code
docker-compose up    # Run containerized
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| LLM_BASE_URL | Azure AI Foundry endpoint | Yes |
| LLM_API_KEY | API key | Yes |
| RAG_API_URL | RAG API URL | No |
| PORT | Server port | No (default: 3000) |

## Architecture

Hierarchical Supervisor pattern with 5 agents:

1. **Supervisor** - Routes queries, coordinates agents
2. **Classifier** - Classifies query type (factual, analytical, etc.)
3. **Retriever** - Calls RAG API for document retrieval
4. **Generator** - Produces answers with context
5. **Critic** - Evaluates quality, triggers refinement

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/v1/chat | Submit query |
| POST | /api/v1/chat/stream | Streaming response |

## Session Instructions

### Start of Every Session

```typescript
// Use memory tools to recall context
mcp__memory__aim_memory_search({ query: "agentic-data-pipeline-agents" })
mcp__memory__aim_memory_get({ names: ["project_context", "current_state"] })
```

1. Review CLAUDE.md and docs/plans/
2. Check for recent changes
3. Load relevant context

### End of Every Session

```typescript
// Store session progress
mcp__memory__aim_memory_store({
  entities: [{
    name: "session_${date}",
    entityType: "session",
    observations: ["Completed: ...", "Next: ..."]
  }]
})
```

1. Store completed tasks and decisions
2. Note blockers and next steps
3. Update docs if architecture changed
