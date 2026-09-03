import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import type {
  VectorStoreInitialization,
  VectorRecord,
  VectorStoreRepository,
  VectorSearchResult,
} from '../domain/vector-store.repository';

@Injectable()
export class QdrantVectorStoreRepository implements VectorStoreRepository {
  private readonly qdrantClient: QdrantClient;
  private readonly collectionName: string;

  constructor(configService: ConfigService) {
    this.collectionName = configService.getOrThrow<string>('QDRANT_COLLECTION');
    this.qdrantClient = new QdrantClient({
      url: configService.getOrThrow<string>('QDRANT_URL'),
    });
  }

  async initialize(vectorSize: number): Promise<VectorStoreInitialization> {
    const collection = await this.qdrantClient.collectionExists(
      this.collectionName,
    );

    if (!collection.exists) {
      await this.qdrantClient.createCollection(this.collectionName, {
        vectors: { size: vectorSize, distance: 'Cosine' },
      });
    }

    return { collection: this.collectionName, created: !collection.exists };
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    await this.qdrantClient.upsert(this.collectionName, {
      wait: true,
      points: records,
    });
  }

  async search(vector: number[], limit: number): Promise<VectorSearchResult[]> {
    const response = await this.qdrantClient.query(this.collectionName, {
      query: vector,
      limit,
      with_payload: true,
    });

    return response.points.flatMap((point) => {
      const payload = this.parsePayload(point.payload);

      if (!payload) {
        return [];
      }

      return [{ id: point.id, score: point.score, payload }];
    });
  }

  private parsePayload(
    payload: unknown,
  ): VectorSearchResult['payload'] | undefined {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return undefined;
    }

    const value = payload as Record<string, unknown>;

    if (
      typeof value.content !== 'string' ||
      typeof value.documentId !== 'string' ||
      typeof value.filename !== 'string' ||
      typeof value.source !== 'string' ||
      typeof value.mimeType !== 'string' ||
      typeof value.chunkIndex !== 'number' ||
      typeof value.totalChunks !== 'number'
    ) {
      return undefined;
    }

    return {
      content: value.content,
      documentId: value.documentId,
      filename: value.filename,
      source: value.source,
      mimeType: value.mimeType,
      page: typeof value.page === 'number' ? value.page : undefined,
      chunkIndex: value.chunkIndex,
      totalChunks: value.totalChunks,
    };
  }
}
