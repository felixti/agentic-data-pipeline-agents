// src/api/middleware/auth.ts
import type { Context, Next } from 'hono'

export async function apiKeyAuth(c: Context, next: Next) {
  const configuredKey = process.env.API_KEY

  // If no API_KEY is configured, allow all requests (dev mode)
  if (!configuredKey) {
    return next()
  }

  const providedKey = c.req.header('X-API-Key')

  if (!providedKey || providedKey !== configuredKey) {
    return c.json({ error: 'Invalid or missing API key' }, 401)
  }

  return next()
}
