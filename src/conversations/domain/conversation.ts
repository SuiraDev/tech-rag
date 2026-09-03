import type { RagSource } from '../../rag/domain/rag-answer';

export type MessageRole = 'user' | 'assistant';

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  sources?: RagSource[];
  createdAt: Date;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages?: ConversationMessage[];
}
