// tests/fixtures/rag-responses.ts
export const ragFixtures = {
  success: {
    results: [
      {
        chunk_id: '1',
        content: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
        hybrid_score: 0.95,
        metadata: { source: 'ml-guide.pdf', page: 1 },
      },
      {
        chunk_id: '2',
        content: 'ML algorithms identify patterns in data and make predictions without explicit programming.',
        hybrid_score: 0.88,
        metadata: { source: 'ml-guide.pdf', page: 2 },
      },
    ],
    total: 2,
    query_time_ms: 45,
  },
  empty: {
    results: [],
    total: 0,
    query_time_ms: 10,
  },
  singleResult: {
    results: [
      {
        chunk_id: '1',
        content: 'Artificial intelligence simulates human intelligence in machines.',
        hybrid_score: 0.92,
        metadata: { source: 'ai-overview.pdf' },
      },
    ],
    total: 1,
    query_time_ms: 30,
  },
}
