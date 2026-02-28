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
  try {
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
  } catch (error) {
    // Handle RAG API failures gracefully - continue with empty results
    return {
      retrievedChunks: [],
      retrievalScore: 0,
      currentAgent: 'retriever',
      errors: [
        ...state.errors,
        {
          agent: 'retriever' as const,
          message: error instanceof Error ? error.message : 'Retrieval failed',
          timestamp: new Date().toISOString(),
        },
      ],
    }
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
