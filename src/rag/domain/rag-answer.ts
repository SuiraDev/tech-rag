export interface RagSource {
  filename: string;
  source: string;
  page?: number;
  chunkIndex: number;
  score: number;
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
}
