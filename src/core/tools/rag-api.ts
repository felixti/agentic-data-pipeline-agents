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
