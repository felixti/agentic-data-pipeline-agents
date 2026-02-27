// tests/fixtures/llm-responses.ts
export const llmFixtures = {
  classifier: {
    factual: {
      queryType: 'factual' as const,
      confidence: 0.95,
      reasoning: 'Direct fact query requiring specific information',
    },
    analytical: {
      queryType: 'analytical' as const,
      confidence: 0.9,
      reasoning: 'Query requires explanation and synthesis',
    },
    vague: {
      queryType: 'vague' as const,
      confidence: 0.6,
      reasoning: 'Unclear intent, needs clarification',
    },
  },
  generator: {
    success: 'Machine learning is a subset of artificial intelligence that uses algorithms to learn from data [1][2]. It enables systems to improve their performance on tasks through experience.',
    withCitations: 'ML enables systems to improve through experience [1]. Key techniques include neural networks [2] and decision trees [3].',
    short: 'ML is AI that learns from data.',
  },
  critic: {
    pass: {
      qualityScore: 0.85,
      needsRefinement: false,
      scores: {
        relevance: 0.9,
        accuracy: 0.85,
        completeness: 0.8,
        clarity: 0.9,
        sourceUsage: 0.85,
      },
    },
    fail: {
      qualityScore: 0.5,
      needsRefinement: true,
      refinementReason: 'Answer is incomplete and lacks sufficient detail',
      scores: {
        relevance: 0.6,
        accuracy: 0.5,
        completeness: 0.4,
        clarity: 0.6,
        sourceUsage: 0.5,
      },
    },
  },
}
