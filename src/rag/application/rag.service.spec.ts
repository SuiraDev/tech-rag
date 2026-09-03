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
        },
      ],
    });
  });
});
