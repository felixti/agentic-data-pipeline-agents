// src/core/llm/provider.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { config } from '../config'

const API_VERSION = '2024-02-15-preview'

// Cache providers per model since Azure needs model in URL path
const _providers = new Map<string, ReturnType<typeof createOpenAICompatible>>()

export function createLLMProvider(modelId: string) {
  // Azure OpenAI format: {baseURL}/openai/deployments/{model}/chat/completions?api-version=...
  return createOpenAICompatible({
    name: 'azure-openai',
    baseURL: `${config.llm.baseUrl}/openai/deployments/${modelId}`,
    headers: {
      'api-key': config.llm.apiKey,
    },
    queryParams: {
      'api-version': API_VERSION,
    },
  })
}

export function getLLM(modelId: string) {
  if (!_providers.has(modelId)) {
    _providers.set(modelId, createLLMProvider(modelId))
  }
  return _providers.get(modelId)!(modelId)
}
