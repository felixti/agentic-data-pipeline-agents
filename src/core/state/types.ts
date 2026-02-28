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
  sessionId: string
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

export const AgentStateAnnotation = Annotation.Root({
  query: Annotation<string>,
  sessionId: Annotation<string>,
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

export function createInitialState(query: string, sessionId: string, context?: ConversationContext): AgentStateValues {
  return {
    query,
    sessionId,
    context,
    iterations: 0,
    errors: [],
  }
}
