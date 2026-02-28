// src/api/__tests__/server.test.ts
import { describe, test, expect } from 'bun:test'
import app from '../server'

describe('API Server', () => {
  test('GET /health returns 200', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('healthy')
  })

  test('POST /api/v1/chat requires query', async () => {
    const res = await app.request('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
