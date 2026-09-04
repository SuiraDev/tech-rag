export interface RagSource {
  filename: string;
  source: string;
  page?: number;
  chunkIndex: number;
  score: number;
  excerpt: string;
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
}
