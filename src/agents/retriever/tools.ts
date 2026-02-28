// src/agents/retriever/tools.ts
import { tool } from 'ai'
import { z } from 'zod'
import { hybridSearch, semanticTextSearch } from '@/core/tools'

export const retrieverTools = [
  tool({
    description: 'Search for documents using hybrid search (vector + text)',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      topK: z.number().optional().describe('Number of results'),
    }),
    execute: async ({ query, topK }) => {
      return hybridSearch({ query, topK: topK ?? 5 })
    },
  }),
  tool({
    description: 'Search for documents using semantic similarity',
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      topK: z.number().optional().describe('Number of results'),
    }),
    execute: async ({ query, topK }) => {
      return semanticTextSearch({ query, topK: topK ?? 5 })
    },
  }),
]
