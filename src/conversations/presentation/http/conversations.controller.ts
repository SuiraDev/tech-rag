import { Controller, Get, Param } from '@nestjs/common';
import { ConversationsService } from '../../application/conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list() {
    return this.conversationsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.conversationsService.get(id);
  }
}
