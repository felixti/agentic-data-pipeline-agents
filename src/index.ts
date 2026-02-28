// src/index.ts
import app from './api/server'
import { config, validateEnv } from './core/config'

validateEnv()

console.log(`Server running at http://localhost:${config.server.port}`)
console.log(`Health: http://localhost:${config.server.port}/health`)
console.log(`Chat: POST http://localhost:${config.server.port}/api/v1/chat`)

export default {
  port: config.server.port,
  fetch: app.fetch,
}
