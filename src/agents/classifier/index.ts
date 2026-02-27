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
