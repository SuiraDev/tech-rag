import { Module } from '@nestjs/common';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { DocumentsService } from './application/documents.service';
import { IndexingJobService } from './application/indexing-job.service';
import { LangChainDocumentChunker } from './infrastructure/langchain-document-chunker';
import { PdfDocumentExtractor } from './infrastructure/pdf-document-extractor';
import { DocumentsController } from './presentation/http/documents.controller';

@Module({
  imports: [VectorStoreModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    IndexingJobService,
    LangChainDocumentChunker,
    PdfDocumentExtractor,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
