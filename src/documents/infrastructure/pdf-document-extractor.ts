import { randomUUID } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import type { StudyDocument } from '../domain';
import type { IngestPdfCommand } from '../application/ingest-pdf.command';

export class PdfDocumentExtractor {
  async extract(command: IngestPdfCommand): Promise<StudyDocument[]> {
    const bytes = Uint8Array.from(command.buffer);
    const parser = new PDFParse({ data: bytes });
    const documentId = randomUUID();
    const filename = command.filename.trim();
    const source = command.source?.trim() || filename;

    try {
      const result = await parser.getText();

      return result.pages
        .filter((page) => page.text.trim())
        .map((page) => ({
          content: page.text,
          metadata: {
            documentId,
            filename,
            source,
            mimeType: 'application/pdf',
            page: page.num,
          },
        }));
    } finally {
      await parser.destroy();
    }
  }
}
