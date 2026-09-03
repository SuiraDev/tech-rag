export interface OllamaGateway {
  chat(prompt: string): Promise<string | unknown[]>;
  embed(text: string): Promise<number[]>;
}
