import { IsOptional, IsString } from 'class-validator';

export class IngestMarkdownRequestDto {
  @IsString()
  content: string;

  @IsString()
  filename: string;

  @IsOptional()
  @IsString()
  source?: string;
}
