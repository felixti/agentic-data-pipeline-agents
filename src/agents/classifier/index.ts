// src/agents/classifier/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan, SemanticConventions } from '@/core/telemetry'
import { CLASSIFIER_SYSTEM_PROMPT } from './prompts'
import type { QueryType } from '@/core/state'

interface ClassificationResult {
  queryType: QueryType
  confidence: number
  reasoning: string
}

export async function classifyQuery(query: string): Promise<ClassificationResult> {
  return createSpan('classify_llm_call', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'llm',
    'llm.model_name': 'gpt-5-mini',
    'input.value': query.substring(0, 500),
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
      'llm.token_count.total': usage?.totalTokens ?? 0,
      'output.value': text.substring(0, 500),
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
