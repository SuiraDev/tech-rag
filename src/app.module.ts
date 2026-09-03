import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConversationsModule } from './conversations/conversations.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { OllamaModule } from './ollama/ollama.module';
import { RagModule } from './rag/rag.module';
import { VectorStoreModule } from './vector-store/vector-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    ConversationsModule,
    DocumentsModule,
    HealthModule,
    OllamaModule,
    RagModule,
    VectorStoreModule,
  ],
})
export class AppModule {}
