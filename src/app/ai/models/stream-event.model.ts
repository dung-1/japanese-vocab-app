export interface OllamaChatMessage {
  role: 'assistant' | 'user' | 'system';
  content: string;
}

export interface OllamaStreamEvent {
  model: string;
  created_at: string;
  // /api/chat fields
  message?: OllamaChatMessage;
  done: boolean;
  done_reason?: string;
  // /api/generate fields (kept for backward compat)
  response?: string;
  // Metrics
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
  // Error
  error?: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  stream: boolean;
  options?: {
    temperature?: number;
    num_ctx?: number;
  };
}

export interface OllamaChatProxyRequest extends OllamaChatRequest {
  // Field pass-through; SSR endpoint will forward to Ollama.
}