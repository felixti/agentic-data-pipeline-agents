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
