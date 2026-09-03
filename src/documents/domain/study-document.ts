export type StudyDocumentMimeType =
  'application/pdf' | 'text/html' | 'text/markdown';

export interface StudyDocumentMetadata {
  documentId: string;
  filename: string;
  source: string;
  mimeType: StudyDocumentMimeType;
  page?: number;
}

export interface StudyDocument {
  content: string;
  metadata: StudyDocumentMetadata;
}

export interface DocumentChunk extends StudyDocument {
  chunkIndex: number;
  totalChunks: number;
}
