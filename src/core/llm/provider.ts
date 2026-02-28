// src/core/llm/provider.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { config } from '../config'

// API versions per model
const API_VERSIONS: Record<string, string> = {
  'gpt-5-mini': '2025-04-01-preview',
  'gpt-4.1': '2025-01-01-preview',
}

function getApiVersion(modelId: string): string {
  return API_VERSIONS[modelId] ?? '2025-01-01-preview'
}

// Cache providers per model since Azure needs model in URL path
const _providers = new Map<string, ReturnType<typeof createOpenAICompatible>>()

export function createLLMProvider(modelId: string) {
  // Azure OpenAI format: {baseURL}/openai/deployments/{model}/chat/completions?api-version=...
  return createOpenAICompatible({
    name: 'azure-openai',
    baseURL: `${config.llm.baseUrl}/openai/deployments/${modelId}`,
    headers: {
      Authorization: `Bearer ${config.llm.apiKey}`,
    },
    queryParams: {
      'api-version': getApiVersion(modelId),
    },
  })
}

export function getLLM(modelId: string) {
  if (!_providers.has(modelId)) {
    _providers.set(modelId, createLLMProvider(modelId))
  }
  return _providers.get(modelId)!(modelId)
}
