// src/api/server.ts
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { errorHandler } from './middleware/error'
import { apiKeyAuth } from './middleware/auth'
import health from './routes/health'
import chat from './routes/chat'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())
app.use('*', errorHandler)

// Health check is public (no auth)
app.route('/health', health)

// API routes require authentication
app.use('/api/v1/*', apiKeyAuth)
app.route('/api/v1/chat', chat)

export default app
