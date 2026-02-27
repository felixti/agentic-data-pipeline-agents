// src/core/llm/provider.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { config } from '../config'

export function createLLMProvider() {
  return createOpenAICompatible({
    name: 'azure-ai-foundry',
    baseURL: config.llm.baseUrl,
    headers: {
      'api-key': config.llm.apiKey,
    },
  })
}

let _provider: ReturnType<typeof createLLMProvider> | null = null

export function getLLM(modelId: string) {
  if (!_provider) {
    _provider = createLLMProvider()
  }
  return _provider(modelId)
}
