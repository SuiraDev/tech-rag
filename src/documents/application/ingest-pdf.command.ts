export interface IngestPdfCommand {
  buffer: Buffer;
  filename: string;
  source?: string;
}
