// src/agents/critic/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan } from '@/core/telemetry'
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
  return createSpan('critique_llm_call', {
    'agent.name': 'critic',
    'llm.model': 'gpt-5-mini',
  }, async (span) => {
    const sourcesText = options.sources.map(s => s.content).join('\n')

    const { text, usage } = await generateText({
      model: getLLM('gpt-5-mini'),
      system: CRITIC_SYSTEM_PROMPT,
      prompt: `Query: ${options.query}

Answer to evaluate:
${options.answer}

Available sources:
${sourcesText || 'No sources provided'}

Evaluate the answer quality.`,
      temperature: 1.0,
      providerOptions: {
        openai: {
          reasoningEffort: 'medium',
        },
      },
    })

    span?.setAttributes({
      'llm.tokens_used': usage?.totalTokens ?? 0,
      'llm.response_length': text.length,
    })

    try {
      const result = JSON.parse(text)
      const critique = {
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

      span?.setAttributes({
        'quality.score': critique.qualityScore,
      })

      return critique
    } catch {
      span?.setAttributes({
        'quality.score': 0.5,
      })
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
  })
}

export { CRITIC_SYSTEM_PROMPT } from './prompts'
