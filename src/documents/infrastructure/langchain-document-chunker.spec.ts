import { LangChainDocumentChunker } from './langchain-document-chunker';

describe('LangChainDocumentChunker', () => {
  it('preserves overlap and document metadata across chunks', async () => {
    const chunker = new LangChainDocumentChunker(20, 5);
    const chunks = await chunker.chunk({
      content: 'alpha bravo charlie delta echo foxtrot golf hotel',
      metadata: {
        documentId: 'document-1',
        filename: 'study.md',
        source: 'study.md',
        mimeType: 'text/markdown',
      },
    });

    expect(chunks).toHaveLength(3);
    expect(chunks[1].content).toContain('delta');
    expect(chunks[1].metadata.documentId).toBe('document-1');
    expect(chunks.map((chunk) => chunk.totalChunks)).toEqual([3, 3, 3]);
  });
});
