import { PromptContext } from './prompt.model';

export type AiRole = 'user' | 'assistant' | 'system';

export type AiProviderType = 'local' | 'cloud';

export interface AiChatMessage {
  id: string;
  role: AiRole;
  content: string;
  createdAt: number;
  contextUsed?: PromptContext;
  sourceCitations?: string[];
  streaming?: boolean;
  error?: string;
}

export interface AiChatSession {
  id: string;
  startedAt: number;
  messages: AiChatMessage[];
}

export interface AiSettings {
  provider: AiProviderType;
  localEndpoint: string;
  cloudApiKey: string;
  cloudModel: string;
  model: string;
  temperature: number;
  topK: number;
  language: 'vi' | 'en' | 'ja';
  streaming: boolean;
  maxContextChars: number;
  enabled: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'local',
  localEndpoint: 'http://localhost:11434',
  cloudApiKey: '',
  cloudModel: 'nemotron-3-super:cloud',
  model: 'nemotron-3-super:cloud',
  temperature: 0.3,
  topK: 5,
  language: 'vi',
  streaming: true,
  maxContextChars: 6000,
  enabled: true,
};
