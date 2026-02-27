// src/agents/supervisor/__tests__/graph.test.ts
import { describe, test, expect } from 'bun:test'
import { createAgentGraph } from '../graph'

describe('Supervisor Graph', () => {
  test('createAgentGraph returns compiled graph', () => {
    const graph = createAgentGraph()
    expect(graph).toBeDefined()
    expect(typeof graph.invoke).toBe('function')
    expect(typeof graph.stream).toBe('function')
  })

  test('graph processes a simple query', async () => {
    const graph = createAgentGraph()
    const result = await graph.invoke({
      query: 'What is AI?',
      iterations: 0,
      errors: [],
    })
    expect(result.finalAnswer).toBeDefined()
  })
})
