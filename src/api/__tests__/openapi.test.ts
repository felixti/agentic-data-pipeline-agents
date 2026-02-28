// src/api/__tests__/openapi.test.ts
import { describe, test, expect } from 'bun:test'
import { generateOpenApiDocument } from '../openapi'

describe('OpenAPI Registry', () => {
  test('registry has correct info', () => {
    const document = generateOpenApiDocument()
    expect(document.info.title).toBe('Agentic Data Pipeline API')
    expect(document.info.version).toBe('1.0.0')
  })

  test('registry has health endpoint', () => {
    const document = generateOpenApiDocument()
    expect(document.paths['/health']).toBeDefined()
    expect(document.paths['/health'].get).toBeDefined()
  })

  test('registry has chat endpoint with security', () => {
    const document = generateOpenApiDocument()
    expect(document.paths['/api/v1/chat']).toBeDefined()
    expect(document.paths['/api/v1/chat'].post).toBeDefined()
    expect(document.paths['/api/v1/chat'].post.security).toEqual([{ ApiKeyAuth: [] }])
  })

  test('registry has chat stream endpoint', () => {
    const document = generateOpenApiDocument()
    expect(document.paths['/api/v1/chat/stream']).toBeDefined()
    expect(document.paths['/api/v1/chat/stream'].post).toBeDefined()
  })

  test('registry has ApiKeyAuth security scheme', () => {
    const document = generateOpenApiDocument()
    expect(document.components?.securitySchemes?.ApiKeyAuth).toEqual({
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    })
  })
})
