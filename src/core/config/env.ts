// src/core/config/env.ts
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue
}

export function validateEnv(): void {
  const required = ['LLM_API_KEY', 'LLM_BASE_URL']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

export const config = {
  llm: {
    baseUrl: getEnv('LLM_BASE_URL', 'https://api.openai.com/v1'),
    apiKey: getEnv('LLM_API_KEY', ''),
  },
  rag: {
    apiUrl: getEnv('RAG_API_URL', 'https://pipeline-api.felixtek.cloud'),
  },
  server: {
    port: Number(getEnv('PORT', '3000')),
  },
} as const
