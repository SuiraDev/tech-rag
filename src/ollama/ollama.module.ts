import { Module } from '@nestjs/common';
import { OllamaService } from './application/ollama.service';
import { LangChainOllamaGateway } from './infrastructure/langchain-ollama.gateway';
import { OllamaController } from './presentation/http/ollama.controller';

@Module({
  providers: [OllamaService, LangChainOllamaGateway],
  controllers: [OllamaController],
  exports: [OllamaService],
})
export class OllamaModule {}
