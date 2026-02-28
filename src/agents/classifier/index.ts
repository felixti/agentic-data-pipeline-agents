// src/agents/classifier/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan } from '@/core/telemetry'
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts'
import type { QueryType } from '@/core/state'

interface ClassificationResult {
  queryType: QueryType
  confidence: number
  reasoning: string
}

export async function classifyQuery(query: string): Promise<ClassificationResult> {
  return createSpan('classify_llm_call', {
    'agent.name': 'classifier',
    'llm.model': 'gpt-5-mini',
  }, async (span) => {
    const { text, usage } = await generateText({
      model: getLLM('gpt-5-mini'),
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: `Classify this query: "${query}"`,
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
      const result = JSON.parse(text) as ClassificationResult
      const classification = {
        queryType: result.queryType,
        confidence: Math.min(1, Math.max(0, result.confidence)),
        reasoning: result.reasoning,
      }

      span?.setAttributes({
        'query.type': classification.queryType,
      })

      return classification
    } catch {
      span?.setAttributes({
        'query.type': 'vague',
      })
      return {
        queryType: 'vague' as QueryType,
        confidence: 0.5,
        reasoning: 'Failed to parse classification, defaulting to vague',
      }
    }
  })
}

export { CLASSIFIER_SYSTEM_PROMPT } from './prompts'
