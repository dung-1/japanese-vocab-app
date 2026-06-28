export const environment = {
  production: false,
  ai: {
    ollamaProxy: '/api/ai/chat',
    ollamaDirect: 'http://localhost:11434',
    model: 'nemotron-3-super:cloud',
    temperature: 0.3,
    topK: 5,
    maxContextChars: 6000,
    enableStreaming: true,
  },
};