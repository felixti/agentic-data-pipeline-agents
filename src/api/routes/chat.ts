// src/api/routes/chat.ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createAgentGraph } from '@/agents/supervisor'
import { withSessionContext } from '@/core/telemetry'

const chat = new Hono()
const graph = createAgentGraph()

/**
 * Get or generate session ID using hybrid approach.
 * Uses conversationId if provided, otherwise generates a new UUID.
 */
function resolveSessionId(conversationId?: string): string {
  return conversationId || crypto.randomUUID()
}

chat.post('/', async (c) => {
  const body = await c.req.json<{ query: string; conversationId?: string }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  const sessionId = resolveSessionId(body.conversationId)

  try {
    const result = await withSessionContext(sessionId, async () => {
      return graph.invoke({
        query: body.query,
        sessionId,
        conversationId: body.conversationId,
        iterations: 0,
        errors: [],
      })
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
  const body = await c.req.json<{ query: string; conversationId?: string }>()

  if (!body.query) {
    return c.json({ error: 'Query is required' }, 400)
  }

  const sessionId = resolveSessionId(body.conversationId)

  return streamSSE(c, async (stream) => {
    await withSessionContext(sessionId, async () => {
      const eventStream = await graph.stream({
        query: body.query,
        sessionId,
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
})

export default chat
