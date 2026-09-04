import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import type {
  LibraryStats,
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
      return { collection: this.collectionName, created: true };
    }

    const existingSize = await this.getExistingVectorSize();

    if (existingSize !== undefined && existingSize !== vectorSize) {
      throw new Error(
        `Qdrant collection "${this.collectionName}" expects vectors of size ${existingSize}, but got ${vectorSize}. ` +
          `The embedding model probably changed: use a new QDRANT_COLLECTION or recreate the collection.`,
      );
    }

    return { collection: this.collectionName, created: false };
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    await this.qdrantClient.upsert(this.collectionName, {
      wait: true,
      points: records,
    });
  }

  async search(vector: number[], limit: number): Promise<VectorSearchResult[]> {    const response = await this.qdrantClient.query(this.collectionName, {
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

  async getStats(): Promise<LibraryStats> {
    try {
      const counted = await this.qdrantClient.count(this.collectionName, {
        exact: true,
      });
      const documents = await this.countDistinctDocuments();
      return { chunks: counted.count, documents };
    } catch {
      // Coleção inexistente ou Qdrant indisponível: biblioteca vazia, não erro.
      return { chunks: 0, documents: 0 };
    }
  }

  private async countDistinctDocuments(): Promise<number> {
    const seen = new Set<string>();
    let offset: number | string | undefined;

    for (let page = 0; page < 10; page++) {
      const scrolled = await this.qdrantClient.scroll(this.collectionName, {
        limit: 500,
        offset,
        with_payload: true,
        with_vector: false,
      });

      for (const point of scrolled.points ?? []) {
        const payload = (point as { payload?: unknown }).payload as Record<
          string,
          unknown
        > | undefined;
        if (payload && typeof payload.documentId === 'string') {
          seen.add(payload.documentId);
        }
      }

      const nextOffset: unknown = scrolled.next_page_offset;
      if (typeof nextOffset !== 'string' && typeof nextOffset !== 'number') {
        break;
      }
      offset = nextOffset;
    }

    return seen.size;
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

  private async getExistingVectorSize(): Promise<number | undefined> {
    try {
      const info = await this.qdrantClient.getCollection(this.collectionName);
      const vectors = info.config?.params?.vectors as
        { size?: number } | Record<string, { size?: number }> | undefined;

      if (!vectors || typeof vectors !== 'object') {
        return undefined;
      }

      if (typeof (vectors as { size?: number }).size === 'number') {
        return (vectors as { size?: number }).size;
      }

      const first = Object.values(vectors)[0] as { size?: number } | undefined;
      return typeof first?.size === 'number' ? first.size : undefined;
    } catch {
      return undefined;
    }
  }
}
