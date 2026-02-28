// src/agents/generator/index.ts
import { generateText } from 'ai'
import { getLLM } from '@/core/llm'
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

  return {
    answer: text,
    sources: options.chunks,
    tokensUsed: usage?.totalTokens,
  }
}

export { GENERATOR_SYSTEM_PROMPT } from './prompts'
