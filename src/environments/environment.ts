export const environment = {
  production: false,
  ai: {
    ollamaProxy: '/api/chat',       // NEW proxy (local + cloud)
    ollamaLegacyProxy: '/api/ai/chat', // OLD proxy (local only) — giữ để backward compat
    ollamaDirect: 'http://localhost:11434',
    model: 'qwen3:0.6b',            // model Local mặc định an toàn (522 MB)
    cloudModel: 'nemotron-3-super:cloud', // model Cloud mặc định
    temperature: 0.3,
    topK: 5,
    maxContextChars: 6000,
    enableStreaming: true,
  },
};