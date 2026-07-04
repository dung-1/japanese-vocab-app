export type EmbeddingVector = number[];

export interface EmbeddingCache {
  [itemId: string]: EmbeddingVector;
}

export interface EmbeddingResponse {
  embedding: EmbeddingVector;
}
