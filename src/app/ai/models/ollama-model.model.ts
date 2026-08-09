/** Shared type cho Ollama cloud model — dùng ở Angular component lẫn Vercel API */
export interface OllamaCloudModel {
  name: string;        // "nemotron-3-super"
  tag: string;         // "nemotron-3-super:cloud"
  description: string; // mô tả ngắn
  pulls: string;       // "2.9M"
  tags: string[];      // ["tools", "thinking", "cloud"]
}
