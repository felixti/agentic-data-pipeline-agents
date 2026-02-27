// src/core/config/env.ts

/**
 * Get an environment variable value without a default.
 * Returns undefined if the variable is not set.
 */
export function getEnv(key: string): string | undefined
/**
 * Get an environment variable value with a default.
 * Returns the default value if the variable is not set.
 */
export function getEnv(key: string, defaultValue: string): string
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue
}

/**
 * Required environment variables that must be set.
 */
const REQUIRED_VARS = ['LLM_API_KEY', 'LLM_BASE_URL'] as const

/**
 * Validates that all required environment variables are set.
 * Throws an error if any are missing.
 */
export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

/**
 * Validates that a port number is valid (positive integer in valid range).
 */
function validatePort(value: number, varName: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid ${varName}: must be a positive integer between 1 and 65535, got ${value}`)
  }
  return value
}

interface Config {
  llm: {
    baseUrl: string
    apiKey: string
  }
  rag: {
    apiUrl: string
  }
  server: {
    port: number
  }
}

/**
 * Lazily evaluated config object.
 * Validates required environment variables on first access.
 */
let _config: Config | undefined

function createConfig(): Config {
  // Validate required environment variables
  validateEnv()

  const portValue = Number(getEnv('PORT', '3000'))

  return {
    llm: {
      baseUrl: getEnv('LLM_BASE_URL', 'https://api.openai.com/v1'),
      apiKey: getEnv('LLM_API_KEY')!, // Safe because validateEnv() ensures it exists
    },
    rag: {
      apiUrl: getEnv('RAG_API_URL', 'https://pipeline-api.felixtek.cloud'),
    },
    server: {
      port: validatePort(portValue, 'PORT'),
    },
  }
}

/**
 * Application configuration object.
 * Throws an error if required environment variables are not set.
 * Lazily evaluated on first access.
 */
export const config: Config = new Proxy({} as Config, {
  get(_, prop: keyof Config) {
    if (!_config) {
      _config = createConfig()
    }
    return _config[prop]
  },
})
