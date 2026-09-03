import { Module } from '@nestjs/common';
import { OllamaModule } from '../ollama/ollama.module';
import { VectorStoreService } from './application/vector-store.service';
import { QdrantVectorStoreRepository } from './infrastructure/qdrant-vector-store.repository';
import { VectorStoreController } from './presentation/http/vector-store.controller';

@Module({
  imports: [OllamaModule],
  controllers: [VectorStoreController],
  providers: [VectorStoreService, QdrantVectorStoreRepository],
  exports: [VectorStoreService],
})
export class VectorStoreModule {}
