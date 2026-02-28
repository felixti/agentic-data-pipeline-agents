// src/agents/generator/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
import { createSpan, SemanticConventions } from '@/core/telemetry'
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
  return createSpan('generate_llm_call', {
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: 'llm',
    'llm.model_name': 'gpt-4.1',
    'input.value': options.query.substring(0, 500),
    'llm.chunk_count': options.chunks.length,
  }, async (span) => {
    const contextText = options.chunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
      .join('\n\n')

    const { text, usage } = await generateText({
      model: getLLM('gpt-4.1'),
      system: GENERATOR_SYSTEM_PROMPT,
      prompt: `Query: ${options.query}

Context:
${contextText}

${options.conversationContext ? `Previous context: ${options.conversationContext}` : ''}

Provide a comprehensive answer with source citations.`,
    })

    span?.setAttributes({
      'llm.token_count.total': usage?.totalTokens ?? 0,
      'llm.token_count.prompt': usage?.inputTokens ?? 0,
      'llm.token_count.completion': usage?.outputTokens ?? 0,
      'output.value': text.substring(0, 500),
    })

    return {
      answer: text,
      sources: options.chunks,
      tokensUsed: usage?.totalTokens,
    }
  })
}

export { GENERATOR_SYSTEM_PROMPT } from './prompts'
