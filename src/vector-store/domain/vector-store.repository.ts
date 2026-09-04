export interface VectorStoreInitialization {
  collection: string;
  created: boolean;
}

export interface VectorRecord {
  id: string;
  vector: number[];
  payload: Record<string, string | number | undefined>;
}

export interface VectorSearchResult {
  id: string | number;
  score: number;
  payload: VectorRecord['payload'];
}

export interface LibraryStats {
  chunks: number;
  documents: number;
}

export interface VectorStoreRepository {
  initialize(vectorSize: number): Promise<VectorStoreInitialization>;
  upsert(records: VectorRecord[]): Promise<void>;
  search(vector: number[], limit: number): Promise<VectorSearchResult[]>;
  getStats(): Promise<LibraryStats>;
}
