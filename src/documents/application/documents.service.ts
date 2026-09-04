import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DocumentChunk, StudyDocument } from '../domain';
import { LangChainDocumentChunker } from '../infrastructure/langchain-document-chunker';
import { PdfDocumentExtractor } from '../infrastructure/pdf-document-extractor';
import { VectorStoreService } from '../../vector-store/application/vector-store.service';
import type { IngestPdfCommand } from './ingest-pdf.command';
import type { IngestMarkdownCommand } from './ingest-markdown.command';
import type { IndexingProgress } from './indexing-job.service';

export interface MarkdownIngestion {
  document: StudyDocument;
  chunks: DocumentChunk[];
  indexedChunks: number;
}

export interface PdfIngestion {
  documents: StudyDocument[];
  chunks: DocumentChunk[];
  indexedChunks: number;
}

export interface LibraryStats {
  indexedChunks: number;
  indexedDocuments: number;
}

type IndexingProgressReporter = (
  progress: Omit<IndexingProgress, 'jobId'>,
) => void;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentChunker: LangChainDocumentChunker,
    private readonly pdfDocumentExtractor: PdfDocumentExtractor,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async ingestMarkdown(
    command: IngestMarkdownCommand,
  ): Promise<MarkdownIngestion> {
    const content = command.content;
    const filename = command.filename.trim();

    if (!content.trim()) {
      throw new Error('Markdown content cannot be empty');
    }

    if (!filename) {
      throw new Error('Markdown filename cannot be empty');
    }

    const document: StudyDocument = {
      content,
      metadata: {
        documentId: randomUUID(),
        filename,
        source: command.source?.trim() || filename,
        mimeType: 'text/markdown',
      },
    };

    const chunks = await this.documentChunker.chunk(document);
    const indexedChunks = await this.vectorStoreService.index(chunks);

    return { document, chunks, indexedChunks };
  }

  async ingestPdf(
    command: IngestPdfCommand,
    reportProgress?: IndexingProgressReporter,
  ): Promise<PdfIngestion> {
    reportProgress?.({ stage: 'extracting' });
    const documents = await this.pdfDocumentExtractor.extract(command);

    if (!documents.length) {
      throw new Error('PDF has no extractable text');
    }

    reportProgress?.({
      stage: 'chunking',
      processed: 0,
      total: documents.length,
    });
    const chunks = await this.documentChunker.chunkDocuments(documents);
    reportProgress?.({
      stage: 'embedding',
      processed: 0,
      total: chunks.length,
    });
    const indexedChunks = await this.vectorStoreService.index(
      chunks,
      (processed, total) =>
        reportProgress?.({ stage: 'embedding', processed, total }),
    );
    reportProgress?.({
      stage: 'storing',
      processed: indexedChunks,
      total: indexedChunks,
    });

    return { documents, chunks, indexedChunks };
  }

  async getStats(): Promise<LibraryStats> {
    const stats = await this.vectorStoreService.getStats();
    return { indexedChunks: stats.chunks, indexedDocuments: stats.documents };
  }
}
