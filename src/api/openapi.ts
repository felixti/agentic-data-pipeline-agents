// src/api/openapi.ts
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

// Helper to generate OpenAPI document from registry
export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Agentic Data Pipeline API',
      version: '1.0.0',
      description: 'Multi-agent RAG system for conversational Q&A',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development',
      },
    ],
  })
}

// Security scheme
const ApiKeyAuth = registry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
})

// Schemas
const HealthResponseSchema = registry.register(
  'HealthResponse',
  z.object({
    status: z.string().openapi({ example: 'healthy' }),
  })
)

const ChatRequestSchema = registry.register(
  'ChatRequest',
  z.object({
    query: z.string().openapi({ example: 'What is LiteLLM?' }),
    conversationId: z.string().optional().openapi({ example: 'conv-123' }),
  })
)

const SourceSchema = registry.register(
  'Source',
  z.object({
    chunkId: z.string().openapi({ example: 'chunk-abc' }),
    content: z.string().openapi({ example: 'LiteLLM is a proxy...' }),
    score: z.number().openapi({ example: 0.95 }),
  })
)

const ChatResponseSchema = registry.register(
  'ChatResponse',
  z.object({
    answer: z.string().openapi({ example: 'LiteLLM is a lightweight LLM proxy...' }),
    queryType: z.string().optional().openapi({ example: 'factual' }),
    qualityScore: z.number().optional().openapi({ example: 0.85 }),
    sources: z.array(SourceSchema).optional(),
  })
)

const ErrorResponseSchema = registry.register(
  'ErrorResponse',
  z.object({
    error: z.string().openapi({ example: 'Invalid or missing API key' }),
  })
)

// Routes
registry.registerPath({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  tags: ['Health'],
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/chat',
  summary: 'Submit a query to the agent system',
  tags: ['Chat'],
  security: [{ [ApiKeyAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: ChatResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/chat/stream',
  summary: 'Submit a query with SSE streaming response',
  tags: ['Chat'],
  security: [{ [ApiKeyAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'SSE stream of agent events',
      content: {
        'text/event-stream': {
          schema: z.object({
            event: z.string(),
            data: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

