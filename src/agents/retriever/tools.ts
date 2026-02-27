// src/agents/retriever/tools.ts
import { tool } from 'ai'
import { z } from 'zod'
import { hybridSearch, semanticTextSearch } from '@/core/tools'

export const retrieverTools = [
  tool({
    description: 'Search for documents using hybrid search (vector + text)',
    parameters: z.object({
      query: z.string().describe('The search query'),
      topK: z.number().optional().describe('Number of results'),
    }),
    execute: async ({ query, topK = 5 }) => {
      return hybridSearch({ query, topK })
    },
  }),
  tool({
    description: 'Search for documents using semantic similarity',
    parameters: z.object({
      query: z.string().describe('The search query'),
      topK: z.number().optional().describe('Number of results'),
    }),
    execute: async ({ query, topK = 5 }) => {
      return semanticTextSearch({ query, topK })
    },
  }),
]
