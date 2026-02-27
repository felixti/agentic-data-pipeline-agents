// src/api/routes/chat.ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createAgentGraph } from '@/agents/supervisor'

const chat = new Hono()
const graph = createAgentGraph()

chat.post('/', async (c) => {
  const body = await c.req.json<{ query: string; conversationId?: string }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  try {
    const result = await graph.invoke({
      query: body.query,
      conversationId: body.conversationId,
      iterations: 0,
      errors: [],
    })

    return c.json({
      answer: result.finalAnswer,
      queryType: result.queryType,
      qualityScore: result.qualityScore,
      sources: result.retrievedChunks?.map((chunk) => ({
        chunkId: chunk.chunkId,
        content: chunk.content.substring(0, 200),
        score: chunk.score,
      })),
    })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    )
  }
})

chat.post('/stream', async (c) => {
  const body = await c.req.json<{ query: string }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  return streamSSE(c, async (stream) => {
    const eventStream = await graph.stream({
      query: body.query,
      iterations: 0,
      errors: [],
    })

    for await (const event of eventStream) {
      await stream.writeSSE({
        data: JSON.stringify(event),
        event: 'agent_update',
        id: Date.now().toString(),
      })
    }
  })
})

export default chat
