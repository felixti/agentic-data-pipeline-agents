// src/index.ts
import { initPhoenix } from './core/telemetry'
import app from './api/server'
import { config, validateEnv } from './core/config'

// Enable AI SDK OpenTelemetry instrumentation
// Must be set before any AI SDK calls
process.env.AI_SDK_OTEL_ENABLED = 'true'

validateEnv()
initPhoenix()

console.log(`Server running at http://localhost:${config.server.port}`)
console.log(`Health: http://localhost:${config.server.port}/health`)
console.log(`Chat: POST http://localhost:${config.server.port}/api/v1/chat`)

export default {
  port: config.server.port,
  fetch: app.fetch,
}
