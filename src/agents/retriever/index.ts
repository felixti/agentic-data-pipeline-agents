// src/agents/retriever/index.ts
import { hybridSearch, type SearchResult } from '@/core/tools'
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

  const response = await hybridSearch({
    query: options.query,
    topK,
    vectorWeight: options.queryType === 'analytical' ? 0.6 : 0.7,
    textWeight: options.queryType === 'analytical' ? 0.4 : 0.3,
  })

  const chunks: RetrievedChunk[] = (response.results ?? []).map((r: SearchResult) => ({
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
