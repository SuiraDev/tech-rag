import {
  Body,
  Controller,
  MessageEvent,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { ConversationsService } from '../../../conversations/application/conversations.service';
import {
  RagJobService,
  type RagProgress,
} from '../../application/rag-job.service';
import { RagService } from '../../application/rag.service';
import { AskQuestionRequestDto } from './dto/ask-question-request.dto';

@Controller('rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly ragJobService: RagJobService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Post('ask')
  ask(@Body() body: AskQuestionRequestDto) {
    return this.ragService.ask(body);
  }

  @Post('jobs')
  async start(@Body() body: AskQuestionRequestDto) {
    const conversation = await this.conversationsService.begin(
      body.question,
      body.conversationId,
    );
    const full = await this.conversationsService.get(conversation.id);
    const history = (full.messages ?? [])
      .slice(0, -1)
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
    const jobId = this.ragJobService.create();
    void this.ragService
      .ask({ ...body, history }, (progress) =>
        this.ragJobService.update(jobId, progress),
      )
      .then((answer) => {
        return this.conversationsService
          .addAnswer(conversation.id, answer)
          .then(() => answer);
      })
      .then((answer) => {
        this.ragJobService.update(jobId, { stage: 'completed', answer });
      })
      .catch((error: unknown) => {
        this.ragJobService.update(jobId, {
          stage: 'failed',
          error: error instanceof Error ? error.message : 'RAG request failed',
        });
      });

    return { jobId, conversationId: conversation.id };
  }

  @Sse('jobs/:jobId/events')
  events(
    @Param('jobId') jobId: string,
  ): Observable<MessageEvent & { data: RagProgress }> {
    return this.ragJobService.events(jobId);
  }
}
