// src/api/middleware/error.ts
import type { Context, Next } from 'hono'

export async function errorHandler(c: Context, next: Next) {
  try {
    await next()
  } catch (error) {
    console.error('Error:', error)
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      500
    )
  }
}
