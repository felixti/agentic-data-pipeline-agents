// src/api/middleware/__tests__/auth.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { apiKeyAuth } from '../auth'

describe('API Key Auth Middleware', () => {
  const originalEnv = process.env.API_KEY

  beforeEach(() => {
    process.env.API_KEY = 'test-secret-key'
  })

  afterEach(() => {
    if (originalEnv) {
      process.env.API_KEY = originalEnv
    } else {
      delete process.env.API_KEY
    }
  })

  test('allows request with valid X-API-Key header', async () => {
    const app = new Hono()
    app.use('*', apiKeyAuth)
    app.get('/protected', (c) => c.json({ success: true }))

    const res = await app.request('/protected', {
      headers: { 'X-API-Key': 'test-secret-key' },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  test('rejects request with missing X-API-Key header', async () => {
    const app = new Hono()
    app.use('*', apiKeyAuth)
    app.get('/protected', (c) => c.json({ success: true }))

    const res = await app.request('/protected')

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid or missing API key')
  })

  test('rejects request with invalid X-API-Key header', async () => {
    const app = new Hono()
    app.use('*', apiKeyAuth)
    app.get('/protected', (c) => c.json({ success: true }))

    const res = await app.request('/protected', {
      headers: { 'X-API-Key': 'wrong-key' },
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Invalid or missing API key')
  })

  test('allows all requests when API_KEY is not set', async () => {
    delete process.env.API_KEY

    const app = new Hono()
    app.use('*', apiKeyAuth)
    app.get('/protected', (c) => c.json({ success: true }))

    const res = await app.request('/protected')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })
})
