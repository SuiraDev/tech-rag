import type { DocumentChunk } from '../../documents/domain';
import { OllamaService } from '../../ollama/application/ollama.service';
import type { VectorRecord } from '../domain/vector-store.repository';
import { QdrantVectorStoreRepository } from '../infrastructure/qdrant-vector-store.repository';
import { VectorStoreService } from './vector-store.service';

describe('VectorStoreService', () => {
  it('embeds and persists every document chunk', async () => {
    const embeddedTexts: string[] = [];
    const upsertedRecords: VectorRecord[][] = [];
    const ollamaService = {
      embed(text: string) {
        embeddedTexts.push(text);
        return Promise.resolve([0.1, 0.2]);
      },
    } as unknown as OllamaService;
    const vectorStoreRepository = {
      initialize() {
        return Promise.resolve({
          collection: 'tech_knowledge',
          created: false,
        });
      },
      upsert(records: VectorRecord[]) {
        upsertedRecords.push(records);
        return Promise.resolve();
      },
      search() {
        return Promise.resolve([]);
      },
    } as unknown as QdrantVectorStoreRepository;
    const vectorStoreService = new VectorStoreService(
      ollamaService,
      vectorStoreRepository,
    );
    const chunks: DocumentChunk[] = [
      {
        content: 'Providers são injetáveis.',
        chunkIndex: 0,
        totalChunks: 1,
        metadata: {
          documentId: 'document-1',
          filename: 'providers.md',
          source: 'providers.md',
          mimeType: 'text/markdown',
        },
      },
    ];

    await expect(vectorStoreService.index(chunks)).resolves.toBe(1);
    expect(embeddedTexts).toEqual([
      'vector dimension probe',
      'Providers são injetáveis.',
    ]);
    expect(upsertedRecords).toHaveLength(1);
    expect(upsertedRecords[0]).toHaveLength(1);
    expect(upsertedRecords[0][0].vector).toEqual([0.1, 0.2]);
    expect(upsertedRecords[0][0].payload).toMatchObject({
      content: 'Providers são injetáveis.',
      documentId: 'document-1',
    });
  });

  it('embeds a query and delegates semantic search to Qdrant', async () => {
    const searchedVectors: number[][] = [];
    const ollamaService = {
      embed: () => Promise.resolve([0.4, 0.5]),
    } as unknown as OllamaService;
    const vectorStoreRepository = {
      initialize: () =>
        Promise.resolve({ collection: 'tech_knowledge', created: false }),
      upsert: () => Promise.resolve(),
      search(vector: number[]) {
        searchedVectors.push(vector);
        return Promise.resolve([
          {
            id: 'point-1',
            score: 0.91,
            payload: {
              content: 'Providers são injetáveis.',
              documentId: 'document-1',
              filename: 'providers.md',
              source: 'providers.md',
              mimeType: 'text/markdown',
              chunkIndex: 0,
              totalChunks: 1,
            },
          },
        ]);
      },
    } as unknown as QdrantVectorStoreRepository;
    const vectorStoreService = new VectorStoreService(
      ollamaService,
      vectorStoreRepository,
    );

    await expect(
      vectorStoreService.search('O que é um provider?', 3),
    ).resolves.toHaveLength(1);
    expect(searchedVectors).toEqual([[0.4, 0.5]]);
  });
});
