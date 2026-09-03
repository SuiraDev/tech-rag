import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DocumentChunk } from '../../documents/domain';
import { OllamaService } from '../../ollama/application/ollama.service';
import type {
  VectorStoreInitialization,
  VectorRecord,
  VectorSearchResult,
} from '../domain/vector-store.repository';
import { QdrantVectorStoreRepository } from '../infrastructure/qdrant-vector-store.repository';

@Injectable()
export class VectorStoreService {
  constructor(
    private readonly ollamaService: OllamaService,
    private readonly vectorStoreRepository: QdrantVectorStoreRepository,
  ) {}

  async initialize(): Promise<VectorStoreInitialization> {
    const probeVector = await this.ollamaService.embed(
      'vector dimension probe',
    );
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
    let processed = 0;
    const records = await Promise.all(
      chunks.map(async (chunk) => {
        const record = await this.createVectorRecord(chunk);
        processed += 1;
        onEmbeddingProgress?.(processed, chunks.length);
        return record;
      }),
    );
    await this.vectorStoreRepository.upsert(records);

    return records.length;
  }

  async search(query: string, limit = 4): Promise<VectorSearchResult[]> {
    const vector = await this.ollamaService.embed(query);
    return this.vectorStoreRepository.search(vector, limit);
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
