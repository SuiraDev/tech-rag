import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DocumentChunk } from '../../documents/domain';
import { OllamaService } from '../../ollama/application/ollama.service';
import type {
  LibraryStats,
  VectorStoreInitialization,
  VectorRecord,
  VectorSearchResult,
} from '../domain/vector-store.repository';
import { QdrantVectorStoreRepository } from '../infrastructure/qdrant-vector-store.repository';

const EMBEDDING_CONCURRENCY = 5;

@Injectable()
export class VectorStoreService {
  private cachedVectorSize: number | undefined;

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly vectorStoreRepository: QdrantVectorStoreRepository,
  ) {}

  async initialize(): Promise<VectorStoreInitialization> {
    if (this.cachedVectorSize !== undefined) {
      return this.vectorStoreRepository.initialize(this.cachedVectorSize);
    }

    const probeVector = await this.ollamaService.embed(
      'vector dimension probe',
    );
    this.cachedVectorSize = probeVector.length;
    return this.vectorStoreRepository.initialize(probeVector.length);
  }

  async index(
    chunks: DocumentChunk[],
    onEmbeddingProgress?: (processed: number, total: number) => void,
  ): Promise<number> {
    if (!chunks.length) {
      return 0;
    }

    await this.initialize();
    const records: VectorRecord[] = new Array<VectorRecord>(chunks.length);
    let processed = 0;

    for (let i = 0; i < chunks.length; i += EMBEDDING_CONCURRENCY) {
      const batch = chunks.slice(i, i + EMBEDDING_CONCURRENCY);
      const batchRecords = await Promise.all(
        batch.map((chunk) => this.createVectorRecord(chunk)),
      );

      for (let j = 0; j < batchRecords.length; j++) {
        records[i + j] = batchRecords[j];
        processed += 1;
      }
      onEmbeddingProgress?.(processed, chunks.length);
    }

    await this.vectorStoreRepository.upsert(records);

    return records.length;
  }

  async search(query: string, limit = 4): Promise<VectorSearchResult[]> {
    const vector = await this.ollamaService.embed(query);
    return this.vectorStoreRepository.search(vector, limit);
  }

  async getStats(): Promise<LibraryStats> {
    return this.vectorStoreRepository.getStats();
  }

  private async createVectorRecord(
    chunk: DocumentChunk,
  ): Promise<VectorRecord> {
    return {
      id: randomUUID(),
      vector: await this.ollamaService.embed(chunk.content),
      payload: {
        content: chunk.content,
        documentId: chunk.metadata.documentId,
        filename: chunk.metadata.filename,
        source: chunk.metadata.source,
        mimeType: chunk.metadata.mimeType,
        page: chunk.metadata.page,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
      },
    };
  }
}
