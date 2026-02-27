// src/core/state/__tests__/types.test.ts
import { describe, test, expect } from 'bun:test'
import { createInitialState, type AgentState, type QueryType } from '../types'

describe('State Types', () => {
  test('createInitialState returns correct initial state', () => {
    const state = createInitialState('What is machine learning?')
    expect(state.query).toBe('What is machine learning?')
    expect(state.iterations).toBe(0)
    expect(state.errors).toEqual([])
  })

  test('QueryType has all expected values', () => {
    const types: QueryType[] = ['factual', 'analytical', 'comparative', 'vague', 'multi_hop']
    expect(types.length).toBe(5)
  })
})
