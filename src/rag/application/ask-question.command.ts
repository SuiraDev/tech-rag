export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskQuestionCommand {
  question: string;
  limit?: number;
  history?: ChatHistoryMessage[];
}
