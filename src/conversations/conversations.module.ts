import { Module } from '@nestjs/common';
import { ConversationsService } from './application/conversations.service';
import { ConversationsController } from './presentation/http/conversations.controller';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
