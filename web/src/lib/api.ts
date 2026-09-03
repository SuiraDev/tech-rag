const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface RagSource {
  filename: string;
  source: string;
  page?: number;
  chunkIndex: number;
  score: number;
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RagSource[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ConversationMessage[];
}

export type RagProgressStage =
  | "queued"
  | "searching"
  | "answering"
  | "completed"
  | "failed";

export interface RagProgress {
  jobId: string;
  stage: RagProgressStage;
  sources?: RagSource[];
  answer?: RagAnswer;
  error?: string;
}

export interface MarkdownIngestion {
  indexedChunks: number;
}

export type IndexingStage =
  | "queued"
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "completed"
  | "failed";

export interface IndexingProgress {
  jobId: string;
  stage: IndexingStage;
  processed?: number;
  total?: number;
  indexedChunks?: number;
  error?: string;
}

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Não foi possível concluir a solicitação.');
  }

  return response.json() as Promise<T>;
}

export function askQuestion(question: string): Promise<RagAnswer> {
  return request<RagAnswer>('/rag/ask', { question, limit: 4 });
}

export function startRagQuestion(
  question: string,
  conversationId?: string,
): Promise<{ jobId: string; conversationId: string }> {
  return request<{ jobId: string; conversationId: string }>("/rag/jobs", {
    question,
    limit: 4,
    conversationId,
  });
}

export async function getConversations(): Promise<Conversation[]> {
  const response = await fetch(`${apiUrl}/conversations`);

  if (!response.ok) {
    throw new Error("Não foi possível carregar as conversas.");
  }

  return response.json() as Promise<Conversation[]>;
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await fetch(`${apiUrl}/conversations/${id}`);

  if (!response.ok) {
    throw new Error("Não foi possível carregar a conversa.");
  }

  return response.json() as Promise<Conversation>;
}

export function subscribeToRag(
  jobId: string,
  onProgress: (progress: RagProgress) => void,
  onError: () => void,
): () => void {
  const events = new EventSource(`${apiUrl}/rag/jobs/${jobId}/events`);

  events.onmessage = (event) => {
    onProgress(JSON.parse(event.data) as RagProgress);
  };
  events.onerror = () => {
    onError();
    events.close();
  };

  return () => events.close();
}

export function ingestMarkdown(
  filename: string,
  source: string,
  content: string,
): Promise<MarkdownIngestion> {
  return request<MarkdownIngestion>('/documents/markdown', {
    filename,
    source,
    content,
  });
}

export async function ingestPdf(file: File): Promise<MarkdownIngestion> {
  const body = new FormData();
  body.append('file', file);

  const response = await fetch(`${apiUrl}/documents/pdf`, {
    method: 'POST',
    body,
  });

  if (!response.ok) {
    throw new Error('Não foi possível enviar o PDF.');
  }

  return response.json() as Promise<MarkdownIngestion>;
}

export async function startPdfIndexing(file: File): Promise<{ jobId: string }> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${apiUrl}/documents/pdf/jobs`, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error("Não foi possível iniciar a indexação do PDF.");
  }

  return response.json() as Promise<{ jobId: string }>;
}

export function subscribeToIndexing(
  jobId: string,
  onProgress: (progress: IndexingProgress) => void,
  onError: () => void,
): () => void {
  const events = new EventSource(`${apiUrl}/documents/indexing/${jobId}/events`);

  events.onmessage = (event) => {
    onProgress(JSON.parse(event.data) as IndexingProgress);
  };
  events.onerror = () => {
    onError();
    events.close();
  };

  return () => events.close();
}
