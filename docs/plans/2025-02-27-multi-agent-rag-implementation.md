# Multi-Agent RAG System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-agent RAG system using LangGraph.js for conversational Q&A with hierarchical supervisor pattern.

**Architecture:** Supervisor agent coordinates Classifier, Retriever, Generator, and Critic agents in a directed flow with conditional routing. Uses vertical slice architecture where each agent is self-contained with its own tools, prompts, and tests.

**Tech Stack:** Bun, TypeScript, LangGraph.js, @ai-sdk/openai-compatible, Hono, Bun test runner, Biome, Docker

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `bunfig.toml`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize Bun project**

```bash
bun init -y
```

**Step 2: Install dependencies**

```bash
bun add @langchain/langgraph @langchain/core ai @ai-sdk/openai-compatible hono zod
bun add -d typescript @types/bun biome
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["bun-types"],
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  }
}
```

**Step 5: Create bunfig.toml**

```toml
[test]
preload = ["./tests/setup.ts"]
parallel = true
coverage = true
coverageThreshold = 0.8

[install]
frozenLockfile = true
```

**Step 6: Create .env.example**

```env
LLM_BASE_URL=https://your-ai-foundry.openai.azure.com
LLM_API_KEY=your-api-key
RAG_API_URL=https://pipeline-api.felixtek.cloud
PORT=3000
```

**Step 7: Create .gitignore**

```
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
.aim/
```

**Step 8: Update package.json scripts**

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
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 9: Commit**

```bash
git add .
git commit -m "chore: initialize project with bun, typescript, biome"
```

---

## Task 2: Core Configuration Module

**Files:**
- Create: `src/core/config/index.ts`
- Create: `src/core/config/env.ts`
- Create: `tests/setup.ts`
- Create: `src/core/config/__tests__/env.test.ts`

**Step 1: Write the failing test**

```typescript
// src/core/config/__tests__/env.test.ts
import { describe, test, expect } from 'bun:test'
import { getEnv, validateEnv } from '../env'

describe('Environment Configuration', () => {
  test('getEnv returns environment variable value', () => {
    process.env.TEST_VAR = 'test-value'
    expect(getEnv('TEST_VAR')).toBe('test-value')
    delete process.env.TEST_VAR
  })

  test('getEnv returns default for missing variable', () => {
    expect(getEnv('MISSING_VAR', 'default')).toBe('default')
  })

  test('validateEnv throws on missing required variables', () => {
    const originalKey = process.env.LLM_API_KEY
    delete process.env.LLM_API_KEY

    expect(() => validateEnv()).toThrow('LLM_API_KEY')

    if (originalKey) process.env.LLM_API_KEY = originalKey
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/config/__tests__/env.test.ts
```
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/core/config/env.ts
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue
}

export function validateEnv(): void {
  const required = ['LLM_API_KEY', 'LLM_BASE_URL']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

export const config = {
  llm: {
    baseUrl: getEnv('LLM_BASE_URL', 'https://api.openai.com/v1'),
    apiKey: getEnv('LLM_API_KEY', ''),
  },
  rag: {
    apiUrl: getEnv('RAG_API_URL', 'https://pipeline-api.felixtek.cloud'),
  },
  server: {
    port: Number(getEnv('PORT', '3000')),
  },
} as const
```

```typescript
// src/core/config/index.ts
export * from './env'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/core/config/__tests__/env.test.ts
```
Expected: PASS

**Step 5: Create tests/setup.ts**

```typescript
// tests/setup.ts
process.env.LLM_API_KEY = 'test-key'
process.env.LLM_BASE_URL = 'https://test.openai.azure.com'
```

**Step 6: Commit**

```bash
git add src/core/config tests/setup.ts
git commit -m "feat(core): add configuration module with env validation"
```

---

## Task 3: LLM Provider Module

**Files:**
- Create: `src/core/llm/index.ts`
- Create: `src/core/llm/provider.ts`
- Create: `src/core/llm/__tests__/provider.test.ts`

**Step 1: Write the failing test**

```typescript
// src/core/llm/__tests__/provider.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createLLMProvider, getLLM } from '../provider'

describe('LLM Provider', () => {
  test('createLLMProvider returns provider instance', () => {
    const provider = createLLMProvider()
    expect(provider).toBeDefined()
    expect(typeof provider).toBe('function')
  })

  test('getLLM returns a model instance', () => {
    const model = getLLM('gpt-4o')
    expect(model).toBeDefined()
  })

  test('provider uses environment configuration', () => {
    const originalUrl = process.env.LLM_BASE_URL
    process.env.LLM_BASE_URL = 'https://custom.api.com/v1'

    const provider = createLLMProvider()
    expect(provider).toBeDefined()

    process.env.LLM_BASE_URL = originalUrl
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/llm/__tests__/provider.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/core/llm/provider.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { config } from '../config'

export function createLLMProvider() {
  return createOpenAICompatible({
    name: 'azure-ai-foundry',
    baseURL: config.llm.baseUrl,
    headers: {
      'api-key': config.llm.apiKey,
    },
  })
}

let _provider: ReturnType<typeof createLLMProvider> | null = null

export function getLLM(modelId: string) {
  if (!_provider) {
    _provider = createLLMProvider()
  }
  return _provider(modelId)
}
```

```typescript
// src/core/llm/index.ts
export * from './provider'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/core/llm/__tests__/provider.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/llm
git commit -m "feat(core): add LLM provider with OpenAI-compatible support"
```

---

## Task 4: State Types Module

**Files:**
- Create: `src/core/state/index.ts`
- Create: `src/core/state/types.ts`
- Create: `src/core/state/__tests__/types.test.ts`

**Step 1: Write the failing test**

```typescript
// src/core/state/__tests__/types.test.ts
import { describe, test, expect } from 'bun:test'
import { createInitialState, type AgentState, type QueryType } from '../types'

describe('State Types', () => {
  test('createInitialState returns correct initial state', () => {
    const state = createInitialState('What is machine learning?')
    expect(state.query).toBe('What is machine learning?')
    expect(state.iterations).toBe(0)
    expect(state.errors).toEqual([])
  })

  test('QueryType has all expected values', () => {
    const types: QueryType[] = ['factual', 'analytical', 'comparative', 'vague', 'multi_hop']
    expect(types.length).toBe(5)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/state/__tests__/types.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/core/state/types.ts
import { Annotation } from '@langchain/langgraph'

export type QueryType = 'factual' | 'analytical' | 'comparative' | 'vague' | 'multi_hop'

export type AgentName = 'supervisor' | 'classifier' | 'retriever' | 'generator' | 'critic'

export interface RetrievedChunk {
  chunkId: string
  content: string
  score: number
  metadata?: Record<string, unknown>
}

export interface ConversationContext {
  previousQueries?: string[]
  previousResponses?: string[]
  sessionId?: string
}

export interface AgentError {
  agent: AgentName
  message: string
  timestamp: string
}

export interface AgentStateValues {
  query: string
  conversationId?: string
  context?: ConversationContext
  queryType?: QueryType
  classificationConfidence?: number
  retrievedChunks?: RetrievedChunk[]
  retrievalScore?: number
  draftAnswer?: string
  finalAnswer?: string
  qualityScore?: number
  needsRefinement?: boolean
  refinementReason?: string
  currentAgent?: AgentName
  iterations: number
  errors: AgentError[]
}

export const AgentStateAnnotation = Annotation<AgentStateValues>({
  query: Annotation<string>,
  conversationId: Annotation<string | undefined>,
  context: Annotation<ConversationContext | undefined>,
  queryType: Annotation<QueryType | undefined>,
  classificationConfidence: Annotation<number | undefined>,
  retrievedChunks: Annotation<RetrievedChunk[] | undefined>,
  retrievalScore: Annotation<number | undefined>,
  draftAnswer: Annotation<string | undefined>,
  finalAnswer: Annotation<string | undefined>,
  qualityScore: Annotation<number | undefined>,
  needsRefinement: Annotation<boolean | undefined>,
  refinementReason: Annotation<string | undefined>,
  currentAgent: Annotation<AgentName | undefined>,
  iterations: Annotation<number>,
  errors: Annotation<AgentError[]>,
})

export function createInitialState(query: string, context?: ConversationContext): AgentStateValues {
  return {
    query,
    context,
    iterations: 0,
    errors: [],
  }
}
```

```typescript
// src/core/state/index.ts
export * from './types'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/core/state/__tests__/types.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/state
git commit -m "feat(core): add state types and annotations for LangGraph"
```

---

## Task 5: RAG API Tools Module

**Files:**
- Create: `src/core/tools/rag-api.ts`
- Create: `src/core/tools/index.ts`
- Create: `src/core/tools/__tests__/rag-api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/core/tools/__tests__/rag-api.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { hybridSearch, semanticTextSearch, ragQuery } from '../rag-api'

// Mock fetch globally
global.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ results: [], total: 0, queryTimeMs: 10 }),
  } as Response)
)

describe('RAG API Tools', () => {
  beforeEach(() => {
    mock.restore()
  })

  test('hybridSearch calls correct endpoint', async () => {
    const result = await hybridSearch({ query: 'test query', topK: 5 })
    expect(result).toBeDefined()
  })

  test('semanticTextSearch calls correct endpoint', async () => {
    const result = await semanticTextSearch({ query: 'test query', topK: 5 })
    expect(result).toBeDefined()
  })

  test('ragQuery calls correct endpoint with strategy', async () => {
    const result = await ragQuery({ query: 'test query', strategy: 'balanced' })
    expect(result).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/tools/__tests__/rag-api.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/core/tools/rag-api.ts
import { config } from '../config'

const RAG_API = config.rag.apiUrl

interface SearchOptions {
  query: string
  topK?: number
  filters?: Record<string, unknown>
}

interface HybridSearchOptions extends SearchOptions {
  vectorWeight?: number
  textWeight?: number
  fusionMethod?: 'weighted_sum' | 'rrf'
}

interface RAGQueryOptions {
  query: string
  strategy?: 'auto' | 'fast' | 'balanced' | 'thorough'
  context?: Record<string, unknown>
  topK?: number
}

export async function hybridSearch(options: HybridSearchOptions) {
  const response = await fetch(`${RAG_API}/api/v1/search/hybrid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: options.query,
      top_k: options.topK ?? 5,
      vector_weight: options.vectorWeight ?? 0.7,
      text_weight: options.textWeight ?? 0.3,
      fusion_method: options.fusionMethod ?? 'weighted_sum',
      filters: options.filters ?? {},
    }),
  })

  if (!response.ok) {
    throw new Error(`Hybrid search failed: ${response.statusText}`)
  }

  return response.json()
}

export async function semanticTextSearch(options: SearchOptions) {
  const response = await fetch(`${RAG_API}/api/v1/search/semantic/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: options.query,
      top_k: options.topK ?? 5,
      filters: options.filters ?? {},
    }),
  })

  if (!response.ok) {
    throw new Error(`Semantic search failed: ${response.statusText}`)
  }

  return response.json()
}

export async function ragQuery(options: RAGQueryOptions) {
  const response = await fetch(`${RAG_API}/api/v1/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: options.query,
      strategy: options.strategy ?? 'auto',
      context: options.context,
      top_k: options.topK ?? 5,
    }),
  })

  if (!response.ok) {
    throw new Error(`RAG query failed: ${response.statusText}`)
  }

  return response.json()
}
```

```typescript
// src/core/tools/index.ts
export * from './rag-api'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/core/tools/__tests__/rag-api.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/tools
git commit -m "feat(core): add RAG API tools for hybrid and semantic search"
```

---

## Task 6: Classifier Agent

**Files:**
- Create: `src/agents/classifier/index.ts`
- Create: `src/agents/classifier/prompts.ts`
- Create: `src/agents/classifier/tools.ts`
- Create: `src/agents/classifier/__tests__/agent.test.ts`

**Step 1: Write the failing test**

```typescript
// src/agents/classifier/__tests__/agent.test.ts
import { describe, test, expect, mock } from 'bun:test'
import { classifyQuery, type QueryType } from '../index'

describe('Classifier Agent', () => {
  test('classifyQuery returns query type and confidence', async () => {
    const result = await classifyQuery('What is machine learning?')
    expect(result.queryType).toBeDefined()
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  test('classifyQuery identifies factual queries', async () => {
    const result = await classifyQuery('What is the capital of France?')
    expect(['factual', 'vague']).toContain(result.queryType)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/agents/classifier/__tests__/agent.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/agents/classifier/prompts.ts
export const CLASSIFIER_SYSTEM_PROMPT = `You are a query classifier. Analyze the user's query and classify it into one of these types:

- factual: Simple fact lookup (e.g., "What is X?", "Who is Y?")
- analytical: Requires explanation or synthesis (e.g., "Explain X", "How does Y work?")
- comparative: Compares multiple items (e.g., "Compare X and Y", "Pros/cons")
- vague: Unclear or broad queries (e.g., "Tell me about...", "Information on...")
- multi_hop: Requires multiple retrieval steps (e.g., "Author of X on topic Y")

Respond with JSON containing:
- queryType: one of the above types
- confidence: number between 0 and 1
- reasoning: brief explanation`
```

```typescript
// src/agents/classifier/tools.ts
// No external tools needed for classification
export const classifierTools = []
```

```typescript
// src/agents/classifier/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts'
import type { QueryType } from '@/core/state'

interface ClassificationResult {
  queryType: QueryType
  confidence: number
  reasoning: string
}

export async function classifyQuery(query: string): Promise<ClassificationResult> {
  const { text } = await generateText({
    model: getLLM('gpt-4o-mini'),
    system: CLASSIFIER_SYSTEM_PROMPT,
    prompt: `Classify this query: "${query}"`,
  })

  try {
    const result = JSON.parse(text) as ClassificationResult
    return {
      queryType: result.queryType,
      confidence: Math.min(1, Math.max(0, result.confidence)),
      reasoning: result.reasoning,
    }
  } catch {
    return {
      queryType: 'vague' as QueryType,
      confidence: 0.5,
      reasoning: 'Failed to parse classification, defaulting to vague',
    }
  }
}

export { CLASSIFIER_SYSTEM_PROMPT } from './prompts'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/agents/classifier/__tests__/agent.test.ts
```
Expected: PASS (with LLM mock or real API)

**Step 5: Commit**

```bash
git add src/agents/classifier
git commit -m "feat(agents): add classifier agent with query type detection"
```

---

## Task 7: Retriever Agent

**Files:**
- Create: `src/agents/retriever/index.ts`
- Create: `src/agents/retriever/prompts.ts`
- Create: `src/agents/retriever/tools.ts`
- Create: `src/agents/retriever/__tests__/agent.test.ts`

**Step 1: Write the failing test**

```typescript
// src/agents/retriever/__tests__/agent.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { retrieveDocuments } from '../index'

global.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        results: [
          { chunkId: '1', content: 'Test content', score: 0.9 },
          { chunkId: '2', content: 'More content', score: 0.8 },
        ],
        total: 2,
        queryTimeMs: 50,
      }),
  } as Response)
)

describe('Retriever Agent', () => {
  beforeEach(() => mock.restore())

  test('retrieveDocuments returns chunks with scores', async () => {
    const result = await retrieveDocuments({
      query: 'test query',
      queryType: 'factual',
      topK: 5,
    })
    expect(result.chunks).toBeDefined()
    expect(result.chunks.length).toBeGreaterThan(0)
  })

  test('retrieveDocuments uses appropriate search strategy', async () => {
    const result = await retrieveDocuments({
      query: 'compare A and B',
      queryType: 'comparative',
      topK: 10,
    })
    expect(result).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/agents/retriever/__tests__/agent.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/agents/retriever/prompts.ts
export const RETRIEVER_SYSTEM_PROMPT = `You are a retrieval specialist. Your job is to:
1. Optimize the search query for better retrieval
2. Determine the best search strategy based on query type
3. Return relevant document chunks for answer generation`
```

```typescript
// src/agents/retriever/tools.ts
import { tool } from 'ai'
import { z } from 'zod'
import { hybridSearch, semanticTextSearch } from '@/core/tools'

export const retrieverTools = [
  tool({
    description: 'Search for documents using hybrid search (vector + text)',
    parameters: z.object({
      query: z.string().describe('The search query'),
      topK: z.number().optional().describe('Number of results'),
    }),
    execute: async ({ query, topK = 5 }) => {
      return hybridSearch({ query, topK })
    },
  }),
  tool({
    description: 'Search for documents using semantic similarity',
    parameters: z.object({
      query: z.string().describe('The search query'),
      topK: z.number().optional().describe('Number of results'),
    }),
    execute: async ({ query, topK = 5 }) => {
      return semanticTextSearch({ query, topK })
    },
  }),
]
```

```typescript
// src/agents/retriever/index.ts
import { hybridSearch } from '@/core/tools'
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

  // Use hybrid search for best results
  const response = await hybridSearch({
    query: options.query,
    topK,
    vectorWeight: options.queryType === 'analytical' ? 0.6 : 0.7,
    textWeight: options.queryType === 'analytical' ? 0.4 : 0.3,
  })

  const chunks: RetrievedChunk[] = (response.results ?? []).map((r: any) => ({
    chunkId: r.chunk_id,
    content: r.content,
    score: r.hybrid_score ?? r.similarity_score ?? 0,
    metadata: r.metadata,
  }))

  const avgScore =
    chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length : 0

  return {
    chunks,
    score: avgScore,
    queryTimeMs: response.query_time_ms ?? 0,
  }
}

export { RETRIEVER_SYSTEM_PROMPT } from './prompts'
export { retrieverTools } from './tools'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/agents/retriever/__tests__/agent.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/retriever
git commit -m "feat(agents): add retriever agent with hybrid search"
```

---

## Task 8: Generator Agent

**Files:**
- Create: `src/agents/generator/index.ts`
- Create: `src/agents/generator/prompts.ts`
- Create: `src/agents/generator/tools.ts`
- Create: `src/agents/generator/__tests__/agent.test.ts`

**Step 1: Write the failing test**

```typescript
// src/agents/generator/__tests__/agent.test.ts
import { describe, test, expect } from 'bun:test'
import { generateAnswer } from '../index'
import type { RetrievedChunk } from '@/core/state'

const mockChunks: RetrievedChunk[] = [
  { chunkId: '1', content: 'Machine learning is a subset of AI.', score: 0.9 },
  { chunkId: '2', content: 'It uses algorithms to learn from data.', score: 0.85 },
]

describe('Generator Agent', () => {
  test('generateAnswer returns answer with sources', async () => {
    const result = await generateAnswer({
      query: 'What is machine learning?',
      chunks: mockChunks,
    })
    expect(result.answer).toBeDefined()
    expect(result.answer.length).toBeGreaterThan(0)
    expect(result.sources.length).toBeGreaterThan(0)
  })

  test('generateAnswer includes source attribution', async () => {
    const result = await generateAnswer({
      query: 'What is machine learning?',
      chunks: mockChunks,
    })
    expect(result.sources[0]?.chunkId).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/agents/generator/__tests__/agent.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/agents/generator/prompts.ts
export const GENERATOR_SYSTEM_PROMPT = `You are an expert answer generator. Given a user query and retrieved document chunks:

1. Synthesize the information from the chunks
2. Provide a clear, accurate, and helpful answer
3. Cite sources using [1], [2], etc. notation
4. Be concise but comprehensive
5. If the chunks don't contain enough information, say so

Format your response with clear structure and cite sources inline.`
```

```typescript
// src/agents/generator/tools.ts
// Generator doesn't need external tools - it uses provided chunks
export const generatorTools = []
```

```typescript
// src/agents/generator/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
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
  const contextText = options.chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
    .join('\n\n')

  const { text, usage } = await generateText({
    model: getLLM('gpt-4o'),
    system: GENERATOR_SYSTEM_PROMPT,
    prompt: `Query: ${options.query}

Context:
${contextText}

${options.conversationContext ? `Previous context: ${options.conversationContext}` : ''}

Provide a comprehensive answer with source citations.`,
  })

  return {
    answer: text,
    sources: options.chunks,
    tokensUsed: usage?.totalTokens,
  }
}

export { GENERATOR_SYSTEM_PROMPT } from './prompts'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/agents/generator/__tests__/agent.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/generator
git commit -m "feat(agents): add generator agent with source attribution"
```

---

## Task 9: Critic Agent

**Files:**
- Create: `src/agents/critic/index.ts`
- Create: `src/agents/critic/prompts.ts`
- Create: `src/agents/critic/tools.ts`
- Create: `src/agents/critic/__tests__/agent.test.ts`

**Step 1: Write the failing test**

```typescript
// src/agents/critic/__tests__/agent.test.ts
import { describe, test, expect } from 'bun:test'
import { critiqueAnswer } from '../index'

describe('Critic Agent', () => {
  test('critiqueAnswer returns quality score', async () => {
    const result = await critiqueAnswer({
      query: 'What is machine learning?',
      answer: 'Machine learning is a subset of artificial intelligence that uses algorithms to learn from data.',
      sources: [
        { chunkId: '1', content: 'ML is a subset of AI.', score: 0.9 },
      ],
    })
    expect(result.qualityScore).toBeGreaterThanOrEqual(0)
    expect(result.qualityScore).toBeLessThanOrEqual(1)
    expect(result.needsRefinement).toBeDefined()
  })

  test('critiqueAnswer identifies poor answers', async () => {
    const result = await critiqueAnswer({
      query: 'What is machine learning?',
      answer: 'I dont know.',
      sources: [],
    })
    expect(result.needsRefinement).toBe(true)
    expect(result.refinementReason).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/agents/critic/__tests__/agent.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/agents/critic/prompts.ts
export const CRITIC_SYSTEM_PROMPT = `You are a quality evaluator. Review the generated answer and evaluate:

1. Relevance: Does it address the query?
2. Accuracy: Is the information correct based on sources?
3. Completeness: Is the answer comprehensive?
4. Clarity: Is the answer clear and well-structured?
5. Source usage: Are sources properly cited?

Score each criterion 0-1 and provide an overall quality score.

Respond with JSON:
{
  "qualityScore": number (0-1),
  "needsRefinement": boolean,
  "refinementReason": string (if needsRefinement is true),
  "scores": {
    "relevance": number,
    "accuracy": number,
    "completeness": number,
    "clarity": number,
    "sourceUsage": number
  }
}`
```

```typescript
// src/agents/critic/tools.ts
export const criticTools = []
```

```typescript
// src/agents/critic/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
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
  const sourcesText = options.sources.map(s => s.content).join('\n')

  const { text } = await generateText({
    model: getLLM('gpt-4o-mini'),
    system: CRITIC_SYSTEM_PROMPT,
    prompt: `Query: ${options.query}

Answer to evaluate:
${options.answer}

Available sources:
${sourcesText || 'No sources provided'}

Evaluate the answer quality.`,
  })

  try {
    const result = JSON.parse(text)
    return {
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
  } catch {
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
}

export { CRITIC_SYSTEM_PROMPT } from './prompts'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/agents/critic/__tests__/agent.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/critic
git commit -m "feat(agents): add critic agent for quality evaluation"
```

---

## Task 10: Supervisor Agent with LangGraph

**Files:**
- Create: `src/agents/supervisor/index.ts`
- Create: `src/agents/supervisor/prompts.ts`
- Create: `src/agents/supervisor/graph.ts`
- Create: `src/agents/supervisor/__tests__/graph.test.ts`

**Step 1: Write the failing test**

```typescript
// src/agents/supervisor/__tests__/graph.test.ts
import { describe, test, expect } from 'bun:test'
import { createAgentGraph } from '../graph'

describe('Supervisor Graph', () => {
  test('createAgentGraph returns compiled graph', () => {
    const graph = createAgentGraph()
    expect(graph).toBeDefined()
    expect(typeof graph.invoke).toBe('function')
    expect(typeof graph.stream).toBe('function')
  })

  test('graph processes a simple query', async () => {
    const graph = createAgentGraph()
    const result = await graph.invoke({
      query: 'What is AI?',
      iterations: 0,
      errors: [],
    })
    expect(result.finalAnswer).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/agents/supervisor/__tests__/graph.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/agents/supervisor/prompts.ts
export const SUPERVISOR_SYSTEM_PROMPT = `You are the supervisor agent coordinating a multi-agent RAG system.

Your role is to:
1. Route queries to appropriate agents
2. Monitor the workflow progress
3. Handle errors gracefully
4. Ensure quality through the critic agent`
```

```typescript
// src/agents/supervisor/graph.ts
import { StateGraph, END, START } from '@langchain/langgraph'
import { AgentStateAnnotation, type AgentStateValues } from '@/core/state'
import { classifyQuery } from '@/agents/classifier'
import { retrieveDocuments } from '@/agents/retriever'
import { generateAnswer } from '@/agents/generator'
import { critiqueAnswer } from '@/agents/critic'

const MAX_ITERATIONS = 2

async function classifierNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  const result = await classifyQuery(state.query)
  return {
    queryType: result.queryType,
    classificationConfidence: result.confidence,
    currentAgent: 'classifier',
  }
}

async function retrieverNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  const result = await retrieveDocuments({
    query: state.query,
    queryType: state.queryType,
    topK: 5,
  })
  return {
    retrievedChunks: result.chunks,
    retrievalScore: result.score,
    currentAgent: 'retriever',
  }
}

async function generatorNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  const result = await generateAnswer({
    query: state.query,
    chunks: state.retrievedChunks ?? [],
  })
  return {
    draftAnswer: result.answer,
    finalAnswer: result.answer,
    currentAgent: 'generator',
  }
}

async function criticNode(state: AgentStateValues): Promise<Partial<AgentStateValues>> {
  const result = await critiqueAnswer({
    query: state.query,
    answer: state.draftAnswer ?? '',
    sources: state.retrievedChunks ?? [],
  })
  return {
    qualityScore: result.qualityScore,
    needsRefinement: result.needsRefinement,
    refinementReason: result.refinementReason,
    currentAgent: 'critic',
    iterations: state.iterations + 1,
  }
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

```typescript
// src/agents/supervisor/index.ts
export { createAgentGraph } from './graph'
export { SUPERVISOR_SYSTEM_PROMPT } from './prompts'
```

**Step 4: Run test to verify it passes**

```bash
bun test src/agents/supervisor/__tests__/graph.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/supervisor
git commit -m "feat(agents): add supervisor agent with LangGraph orchestration"
```

---

## Task 11: API Server with Hono

**Files:**
- Create: `src/api/server.ts`
- Create: `src/api/routes/chat.ts`
- Create: `src/api/routes/health.ts`
- Create: `src/api/middleware/error.ts`
- Create: `src/api/__tests__/server.test.ts`

**Step 1: Write the failing test**

```typescript
// src/api/__tests__/server.test.ts
import { describe, test, expect } from 'bun:test'
import app from '../server'

describe('API Server', () => {
  test('GET /health returns 200', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('healthy')
  })

  test('POST /api/v1/chat requires query', async () => {
    const res = await app.request('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test src/api/__tests__/server.test.ts
```
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/api/routes/health.ts
import { Hono } from 'hono'

const health = new Hono()

health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

export default health
```

```typescript
// src/api/routes/chat.ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createAgentGraph } from '@/agents/supervisor'

const chat = new Hono()
const graph = createAgentGraph()

chat.post('/', async (c) => {
  const body = await c.req.json<{ query: string; conversationId?: string }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  try {
    const result = await graph.invoke({
      query: body.query,
      conversationId: body.conversationId,
      iterations: 0,
      errors: [],
    })

    return c.json({
      answer: result.finalAnswer,
      queryType: result.queryType,
      qualityScore: result.qualityScore,
      sources: result.retrievedChunks?.map((c) => ({
        chunkId: c.chunkId,
        content: c.content.substring(0, 200),
        score: c.score,
      })),
    })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})

chat.post('/stream', async (c) => {
  const body = await c.req.json<{ query: string }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  return streamSSE(c, async (stream) => {
    const eventStream = await graph.stream({
      query: body.query,
      iterations: 0,
      errors: [],
    })

    for await (const event of eventStream) {
      await stream.writeSSE({
        data: JSON.stringify(event),
        event: 'agent_update',
      })
    }
  })
})

export default chat
```

```typescript
// src/api/middleware/error.ts
import { Context, Next } from 'hono'

export async function errorHandler(c: Context, next: Next) {
  try {
    await next()
  } catch (error) {
    console.error('Error:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      500
    )
  }
}
```

```typescript
// src/api/server.ts
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { errorHandler } from './middleware/error'
import health from './routes/health'
import chat from './routes/chat'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())
app.use('*', errorHandler)

app.route('/health', health)
app.route('/api/v1/chat', chat)

export default app
```

**Step 4: Run test to verify it passes**

```bash
bun test src/api/__tests__/server.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/api
git commit -m "feat(api): add Hono server with chat and health endpoints"
```

---

## Task 12: Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Write entry point**

```typescript
// src/index.ts
import { serve } from 'bun'
import app from './api/server'
import { config, validateEnv } from './core/config'

validateEnv()

const server = serve({
  port: config.server.port,
  fetch: app.fetch,
})

console.log(`🚀 Server running at http://localhost:${config.server.port}`)
console.log(`📚 Health: http://localhost:${config.server.port}/health`)
console.log(`💬 Chat: POST http://localhost:${config.server.port}/api/v1/chat`)

export default server
```

**Step 2: Test the server starts**

```bash
bun run dev
```
Expected: Server starts on port 3000

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add entry point with Bun server"
```

---

## Task 13: Docker Configuration

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Step 1: Create Dockerfile**

```dockerfile
# Dockerfile
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production stage
FROM base AS prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
```

**Step 2: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  agent-api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - LLM_BASE_URL=${LLM_BASE_URL}
      - LLM_API_KEY=${LLM_API_KEY}
      - RAG_API_URL=${RAG_API_URL:-https://pipeline-api.felixtek.cloud}
      - PORT=3000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

**Step 3: Create .dockerignore**

```
node_modules
dist
.git
.env
*.log
coverage
.aim
tests
*.test.ts
```

**Step 4: Test Docker build**

```bash
docker-compose build
```
Expected: Build succeeds

**Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: add Docker configuration for containerization"
```

---

## Task 14: CLAUDE.md Documentation

**Files:**
- Create: `CLAUDE.md`

**Step 1: Create CLAUDE.md**

```markdown
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
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project documentation"
```

---

## Task 15: GitHub Repository

**Step 1: Initialize git if not already**

```bash
git init
```

**Step 2: Create repository on GitHub**

```bash
gh repo create agentic-data-pipeline-agents --public --source=. --push
```

**Step 3: Verify repository**

```bash
gh repo view
```

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: initial commit - multi-agent RAG system"
git push -u origin main
```

---

## Verification Checklist

- [ ] All tests pass: `bun test`
- [ ] Linting passes: `bun run lint`
- [ ] TypeScript compiles: `bun run typecheck`
- [ ] Server starts: `bun run dev`
- [ ] Health check works: `curl http://localhost:3000/health`
- [ ] Docker builds: `docker-compose build`
- [ ] Docker runs: `docker-compose up`
- [ ] GitHub repo created: `gh repo view`
