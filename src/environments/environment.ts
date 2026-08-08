export const environment = {
  production: false,
  supabase: { 
    url: 'https://gmvoxzysoixvwdvyvkht.supabase.co',   // ← thay bằng Project URL
    anonKey: 'sb_publishable_XvlZTGo-1AWiI_GkwEy2HQ_NJRxdjgy',                 // ← thay bằng anon/public key
  },
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
