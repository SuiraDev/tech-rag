import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { DocumentChunk, StudyDocument } from '../domain';

export class LangChainDocumentChunker {
  constructor(
    private readonly chunkSize = 1000,
    private readonly chunkOverlap = 150,
  ) {}

  async chunk(document: StudyDocument): Promise<DocumentChunk[]> {
    return this.chunkDocuments([document]);
  }

  async chunkDocuments(documents: StudyDocument[]): Promise<DocumentChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
    const splitDocuments = await splitter.createDocuments(
      documents.map((document) => document.content),
      documents.map((document) => document.metadata),
    );

    return splitDocuments.map((splitDocument, chunkIndex) => ({
      content: splitDocument.pageContent,
      metadata: splitDocument.metadata as StudyDocument['metadata'],
      chunkIndex,
      totalChunks: splitDocuments.length,
    }));
  }
}
