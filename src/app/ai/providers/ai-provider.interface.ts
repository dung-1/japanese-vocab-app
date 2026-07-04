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
  /**
   * Tạo embedding vector cho một đoạn text.
   * Optional — chỉ implement khi provider hỗ trợ /api/embeddings.
   * Trả về mảng số thực (thường 768 chiều với nomic-embed-text).
   * Trả về [] nếu không hỗ trợ hoặc model chưa được pull.
   */
  embed?(text: string): Promise<number[]>;
}
