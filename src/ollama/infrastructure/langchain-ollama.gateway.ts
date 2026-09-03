import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OllamaGateway } from '../domain/ollama-gateway';

@Injectable()
export class LangChainOllamaGateway implements OllamaGateway {
  private readonly chatModel: ChatOllama;
  private readonly embeddingModel: OllamaEmbeddings;

  constructor(configService: ConfigService) {
    this.chatModel = new ChatOllama({
      baseUrl: configService.getOrThrow<string>('OLLAMA_URL'),
      model: configService.getOrThrow<string>('OLLAMA_CHAT_MODEL'),
      temperature: 0,
      maxRetries: 2,
    });
    this.embeddingModel = new OllamaEmbeddings({
      baseUrl: configService.getOrThrow<string>('OLLAMA_URL'),
      model: configService.getOrThrow<string>('OLLAMA_EMBEDDING_MODEL'),
    });
  }

  async chat(prompt: string): Promise<string | unknown[]> {
    const response = await this.chatModel.invoke(prompt);
    return response.content;
  }

  embed(text: string): Promise<number[]> {
    return this.embeddingModel.embedQuery(text);
  }
}
