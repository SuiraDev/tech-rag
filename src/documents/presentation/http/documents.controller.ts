import {
  BadRequestException,
  Body,
  Controller,
  MessageEvent,
  Param,
  Post,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import type { Observable } from 'rxjs';
import { DocumentsService } from '../../application/documents.service';
import {
  IndexingJobService,
  type IndexingProgress,
} from '../../application/indexing-job.service';
import type { IngestMarkdownRequestDto } from './dto/ingest-markdown-request.dto';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly indexingJobService: IndexingJobService,
  ) {}

  @Post('markdown')
  ingestMarkdown(@Body() body: IngestMarkdownRequestDto) {
    return this.documentsService.ingestMarkdown(body);
  }

  @Post('pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  ingestPdf(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A PDF file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported');
    }

    return this.documentsService.ingestPdf({
      buffer: file.buffer,
      filename: file.originalname,
    });
  }

  @Post('pdf/jobs')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  startPdfIndexing(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A PDF file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported');
    }

    const jobId = this.indexingJobService.create();
    void this.documentsService
      .ingestPdf(
        { buffer: file.buffer, filename: file.originalname },
        (progress) => this.indexingJobService.update(jobId, progress),
      )
      .then((ingestion) => {
        this.indexingJobService.update(jobId, {
          stage: 'completed',
          processed: ingestion.indexedChunks,
          total: ingestion.indexedChunks,
          indexedChunks: ingestion.indexedChunks,
        });
      })
      .catch((error: unknown) => {
        this.indexingJobService.update(jobId, {
          stage: 'failed',
          error: error instanceof Error ? error.message : 'Indexing failed',
        });
      });

    return { jobId };
  }

  @Sse('indexing/:jobId/events')
  indexingEvents(
    @Param('jobId') jobId: string,
  ): Observable<MessageEvent & { data: IndexingProgress }> {
    return this.indexingJobService.events(jobId);
  }
}
