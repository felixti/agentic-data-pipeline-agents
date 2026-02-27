// src/api/server.ts
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { errorHandler } from './middleware/error'
import health from './routes/health'
import chat from './routes/chat'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())
app.use('*', errorHandler)

app.route('/health', health)
app.route('/api/v1/chat', chat)

export default app
