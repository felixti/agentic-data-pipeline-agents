// src/api/__tests__/server.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import app from '../server'

describe('API Server', () => {
  const originalApiKey = process.env.API_KEY

  beforeEach(() => {
    process.env.API_KEY = 'test-api-key'
  })

  afterEach(() => {
    if (originalApiKey) {
      process.env.API_KEY = originalApiKey
    } else {
      delete process.env.API_KEY
    }
  })

  test('GET /health returns 200 (no auth required)', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('healthy')
  })

  test('POST /api/v1/chat requires query', async () => {
    const res = await app.request('/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test('POST /api/v1/chat rejects missing API key', async () => {
    const res = await app.request('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  test('POST /api/v1/chat rejects invalid API key', async () => {
    const res = await app.request('/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'wrong-key',
      },
      body: JSON.stringify({ query: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  test('POST /api/v1/chat/stream rejects missing API key', async () => {
    const res = await app.request('/api/v1/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  test('GET /openapi.json returns OpenAPI spec', async () => {
    const res = await app.request('/openapi.json')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { openapi: string; info: { title: string } }
    expect(body.openapi).toBe('3.1.0')
    expect(body.info.title).toBe('Agentic Data Pipeline API')
  })

  test('GET /openapi.yaml returns YAML OpenAPI spec', async () => {
    const res = await app.request('/openapi.yaml')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/yaml')
    const text = await res.text()
    expect(text).toContain('openapi: 3.1.0')
    expect(text).toContain('title: Agentic Data Pipeline API')
  })
})
