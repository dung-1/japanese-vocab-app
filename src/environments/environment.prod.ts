export const environment = {
  production: true,
  ai: {
    ollamaProxy: '/api/chat',
    ollamaLegacyProxy: '/api/ai/chat',
    ollamaDirect: 'http://localhost:11434',
    model: 'qwen3:0.6b',
    cloudModel: 'nemotron-3-super:cloud',
    temperature: 0.3,
    topK: 5,
    maxContextChars: 6000,
    enableStreaming: true,
  },
};