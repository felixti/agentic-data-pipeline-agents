// src/index.ts
import { serve } from 'bun'
import app from './api/server'
import { config, validateEnv } from './core/config'

validateEnv()

const server = serve({
  port: config.server.port,
  fetch: app.fetch,
})

console.log(`Server running at http://localhost:${config.server.port}`)
console.log(`Health: http://localhost:${config.server.port}/health`)
console.log(`Chat: POST http://localhost:${config.server.port}/api/v1/chat`)

export default server
