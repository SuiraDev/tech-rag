import { jest } from '@jest/globals';
import { DocumentsService } from './documents.service';
import { LangChainDocumentChunker } from '../infrastructure/langchain-document-chunker';
import { PdfDocumentExtractor } from '../infrastructure/pdf-document-extractor';
import { VectorStoreService } from '../../vector-store/application/vector-store.service';

describe('DocumentsService', () => {
  const vectorStoreService = {
    index: jest.fn().mockResolvedValue(1),
  } as unknown as VectorStoreService;
  const pdfDocumentExtractor = {
    extract: jest.fn(),
  } as unknown as PdfDocumentExtractor;
  const documentsService = new DocumentsService(
    new LangChainDocumentChunker(),
    pdfDocumentExtractor,
    vectorStoreService,
  );

  it('creates a normalized Markdown document and its chunks', async () => {
    const ingestion = await documentsService.ingestMarkdown({
      content: '  # Providers  ',
      filename: 'providers.md',
      source: 'study/nestjs/providers.md',
    });

    expect(ingestion.document.content).toBe('  # Providers  ');
    expect(ingestion.document.metadata).toMatchObject({
      filename: 'providers.md',
      source: 'study/nestjs/providers.md',
      mimeType: 'text/markdown',
    });
    expect(ingestion.document.metadata.documentId).toEqual(expect.any(String));
    expect(ingestion.chunks).toHaveLength(1);
    expect(ingestion.chunks[0]).toMatchObject({
      content: '# Providers',
      chunkIndex: 0,
      totalChunks: 1,
    });
    expect(ingestion.indexedChunks).toBe(1);
  });

  it('chunks every extractable PDF page and indexes the result', async () => {
    jest.spyOn(pdfDocumentExtractor, 'extract').mockResolvedValue([
      {
        content: 'Providers podem ser injetados.',
        metadata: {
          documentId: 'pdf-1',
          filename: 'nest.pdf',
          source: 'nest.pdf',
          mimeType: 'application/pdf',
          page: 1,
        },
      },
      {
        content: 'Controllers recebem requisições HTTP.',
        metadata: {
          documentId: 'pdf-1',
          filename: 'nest.pdf',
          source: 'nest.pdf',
          mimeType: 'application/pdf',
          page: 2,
        },
      },
    ]);

    const ingestion = await documentsService.ingestPdf({
      buffer: Buffer.from('pdf'),
      filename: 'nest.pdf',
    });

    expect(ingestion.indexedChunks).toBe(1);
    expect(ingestion.chunks).toHaveLength(2);
    expect(ingestion.chunks.map((chunk) => chunk.metadata.page)).toEqual([
      1, 2,
    ]);
    expect(ingestion.chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 0]);
    expect(ingestion.chunks.map((chunk) => chunk.totalChunks)).toEqual([1, 1]);
  });

  it('rejects empty Markdown content', async () => {
    await expect(
      documentsService.ingestMarkdown({
        content: '   ',
        filename: 'providers.md',
      }),
    ).rejects.toThrow('Markdown content cannot be empty');
  });
});
