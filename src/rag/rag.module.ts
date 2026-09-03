import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { OllamaModule } from '../ollama/ollama.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { RagService } from './application/rag.service';
import { RagJobService } from './application/rag-job.service';
import { RagController } from './presentation/http/rag.controller';

@Module({
  imports: [ConversationsModule, OllamaModule, VectorStoreModule],
  controllers: [RagController],
  providers: [RagService, RagJobService],
})
export class RagModule {}
