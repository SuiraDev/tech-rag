import { Injectable } from '@nestjs/common';
import { LangChainOllamaGateway } from '../infrastructure/langchain-ollama.gateway';

@Injectable()
export class OllamaService {
  constructor(private readonly ollamaGateway: LangChainOllamaGateway) {}

  chat(prompt: string): Promise<string | unknown[]> {
    return this.ollamaGateway.chat(prompt);
  }

  embed(text: string): Promise<number[]> {
    return this.ollamaGateway.embed(text);
  }
}
