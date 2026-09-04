import { RagService } from './rag.service';
import { OllamaService } from '../../ollama/application/ollama.service';
import { VectorStoreService } from '../../vector-store/application/vector-store.service';

describe('RagService', () => {
  it('answers with retrieved context and returns its sources', async () => {
    const prompts: string[] = [];
    const vectorStoreService = {
      search: () =>
        Promise.resolve([
          {
            id: 'point-1',
            score: 0.92,
            payload: {
              content: 'Providers são classes que podem ser injetadas.',
              documentId: 'document-1',
              filename: 'providers.md',
              source: 'study/nestjs/providers.md',
              mimeType: 'text/markdown',
              chunkIndex: 0,
              totalChunks: 1,
            },
          },
        ]),
    } as unknown as VectorStoreService;
    const ollamaService = {
      chat(prompt: string) {
        prompts.push(prompt);
        return Promise.resolve('Providers são classes injetáveis.');
      },
    } as unknown as OllamaService;
    const ragService = new RagService(vectorStoreService, ollamaService);

    const answer = await ragService.ask({
      question: 'O que é um provider?',
    });

    expect(prompts[0]).toContain(
      'Providers são classes que podem ser injetadas.',
    );
    expect(answer).toEqual({
      answer: 'Providers são classes injetáveis.',
      sources: [
        {
          filename: 'providers.md',
          source: 'study/nestjs/providers.md',
          chunkIndex: 0,
          score: 0.92,
          excerpt: 'Providers são classes que podem ser injetadas.',
        },
      ],
    });
  });

  it('caps the source excerpt at 300 characters', async () => {
    const longContent = `${'Conteúdo relevante. '.repeat(30)}fim.`;
    const vectorStoreService = {
      search: () =>
        Promise.resolve([
          {
            id: 'point-1',
            score: 0.81,
            payload: {
              content: longContent,
              documentId: 'document-1',
              filename: 'longo.md',
              source: 'study/longo.md',
              mimeType: 'text/markdown',
              chunkIndex: 2,
              totalChunks: 3,
            },
          },
        ]),
    } as unknown as VectorStoreService;
    const ollamaService = {
      chat: () => Promise.resolve('Resumo do conteúdo longo.'),
    } as unknown as OllamaService;
    const ragService = new RagService(vectorStoreService, ollamaService);

    const answer = await ragService.ask({ question: 'Resuma o material.' });
    const excerpt = answer.sources[0]?.excerpt ?? '';

    expect(excerpt.length).toBeLessThanOrEqual(301);
    expect(excerpt.endsWith('…')).toBe(true);
  });
});
