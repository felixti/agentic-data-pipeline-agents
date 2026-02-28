import { describe, test, expect } from 'bun:test'

describe('resolveSessionId', () => {
  function resolveSessionId(conversationId?: string): string {
    return conversationId || crypto.randomUUID()
  }

  test('returns conversationId when provided', () => {
    expect(resolveSessionId('conv-123')).toBe('conv-123')
  })

  test('generates UUID when conversationId not provided', () => {
    const id = resolveSessionId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('generates different UUIDs for each call', () => {
    const id1 = resolveSessionId()
    const id2 = resolveSessionId()
    expect(id1).not.toBe(id2)
  })

  test('returns empty string conversationId', () => {
    // Empty string is falsy, so should generate UUID
    const id = resolveSessionId('')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})
