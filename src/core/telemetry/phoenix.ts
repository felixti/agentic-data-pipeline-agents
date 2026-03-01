// src/core/telemetry/phoenix.ts
import { register } from '@arizeai/phoenix-otel'
import { config } from '../config'
import { context, trace, type Span } from '@opentelemetry/api'
import { setSession, getAttributesFromContext } from '@arizeai/openinference-core'
import { SemanticConventions } from '@arizeai/openinference-semantic-conventions'

let phoenixEnabled = false

/**
 * Initialize Phoenix OpenTelemetry tracing.
 * Gracefully degrades if endpoint is not configured or registration fails.
 */
export function initPhoenix(): void {
  const endpoint = config.telemetry.phoenixEndpoint
  const apiKey = config.telemetry.phoenixApiKey

  if (!endpoint) {
    console.log('[Phoenix] Endpoint not configured, tracing disabled')
    return
  }

  try {
    register({
      projectName: 'agentic-data-pipeline-agents',
      url: endpoint,
      apiKey: apiKey,
    })
    phoenixEnabled = true
    console.log(`[Phoenix] Tracing enabled, endpoint: ${endpoint}`)
  } catch (error) {
    console.warn(
      '[Phoenix] Failed to register:',
      error instanceof Error ? error.message : error
    )
  }
}

/**
 * Check if Phoenix tracing is enabled.
 */
export function isPhoenixEnabled(): boolean {
  return phoenixEnabled
}

/**
 * Get the tracer for Phoenix spans.
 */
function getTracer() {
  return trace.getTracer('agentic-data-pipeline-agents', '1.0.0')
}

/**
 * Execute a function within session context.
 * All spans created within will automatically have session.id attribute.
 */
export async function withSessionContext<T>(
  sessionId: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!phoenixEnabled) {
    return fn()
  }
  return context.with(
    setSession(context.active(), { sessionId }),
    fn
  )
}

/**
 * Create a session-aware span for workflow-level operations.
 * Inherits session.id from context if set via withSessionContext.
 */
export async function createSessionSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span | null) => Promise<T>
): Promise<T> {
  if (!phoenixEnabled) {
    return fn(null)
  }

  const tracer = getTracer()
  return tracer.startActiveSpan(name, async (span) => {
    // Get session.id from context and apply to span
    const contextAttrs = getAttributesFromContext(context.active())
    for (const [key, value] of Object.entries(contextAttrs)) {
      if (value !== undefined) {
        span.setAttribute(key, value)
      }
    }

    // Set provided attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        span.setAttribute(key, value)
      }
    }

    try {
      const result = await fn(span)
      span.setStatus({ code: 0 }) // OK
      return result
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Hybrid span attributes - OpenInference + custom domain attributes
 */
export interface SpanAttributes {
  // OpenInference semantic conventions (common)
  'session.id'?: string
  'user.id'?: string
  'llm.model_name'?: string
  'llm.token_count.total'?: number
  'llm.token_count.prompt'?: number
  'llm.token_count.completion'?: number
  'input.value'?: string
  'output.value'?: string
  'openinference.span.kind'?: 'agent' | 'chain' | 'llm' | 'tool' | 'retriever'

  // Custom domain-specific attributes
  'query.type'?: string
  'retrieval.score'?: number
  'quality.score'?: number
  'iteration.count'?: number
  'workflow.status'?: 'in_progress' | 'completed' | 'failed'
  'tool.name'?: string
  'tool.result_count'?: number

  // Legacy attributes (will be removed in Tasks 9-13)
  /** @deprecated Use openinference.span.kind instead */
  'agent.name'?: string
  /** @deprecated Use llm.model_name instead */
  'llm.model'?: string
  /** @deprecated Use input.value instead */
  'tool.query'?: string
  /** @deprecated Will be removed */
  'tool.top_k'?: number
  /** @deprecated Use retrieval.score instead */
  'tool.score'?: number
  /** @deprecated Use llm.token_count.total instead */
  'llm.tokens_used'?: number
  /** @deprecated Will be removed */
  'llm.response_length'?: number
  /** @deprecated Will be removed */
  'llm.chunk_count'?: number
}

/**
 * Create a span and execute a function within its context.
 * If Phoenix is not enabled, executes the function without tracing.
 *
 * @param name - Span name
 * @param attributes - Initial span attributes
 * @param fn - Async function to execute within span context
 * @returns Result of the function
 */
export async function createSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span | null) => Promise<T>
): Promise<T> {
  if (!phoenixEnabled) {
    return fn(null)
  }

  const tracer = getTracer()
  return tracer.startActiveSpan(name, async (span) => {
    // Inherit session.id from context (set by withSessionContext)
    const contextAttrs = getAttributesFromContext(context.active())
    for (const [key, value] of Object.entries(contextAttrs)) {
      if (value !== undefined) {
        span.setAttribute(key, value)
      }
    }

    // Set provided attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        span.setAttribute(key, value)
      }
    }

    try {
      const result = await fn(span)
      span.setStatus({ code: 0 }) // OK
      return result
    } catch (error) {
      span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  })
}

// Re-export for use in agents
export { SemanticConventions }
