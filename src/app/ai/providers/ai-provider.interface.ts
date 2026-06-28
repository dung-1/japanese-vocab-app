/**
 * Abstract provider cho AI backend.
 * Mỗi provider (Local Ollama, Ollama Cloud, ...) implement interface này.
 */
export interface ChatStreamHandle {
  abort: () => void;
}

export interface ChatRequest {
  system?: string;
  user: string;
  model: string;
  temperature?: number;
  topK?: number;
  stream: boolean;
}

export type ChatTokenHandler = (token: string) => void;
export type ChatDoneHandler = () => void;
export type ChatErrorHandler = (err: Error) => void;

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  chat(
    request: ChatRequest,
    onToken: ChatTokenHandler,
    onDone?: ChatDoneHandler,
    onError?: ChatErrorHandler,
  ): Promise<ChatStreamHandle>;
  testConnection?(): Promise<{ ok: boolean; message: string }>;
}