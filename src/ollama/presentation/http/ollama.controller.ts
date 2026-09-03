import { Body, Controller, Post } from '@nestjs/common';
import { OllamaService } from '../../application/ollama.service';
import type { ChatRequestDto } from './dto/chat-request.dto';
import type { EmbedRequestDto } from './dto/embed-request.dto';

@Controller('ollama')
export class OllamaController {
  constructor(private readonly ollamaService: OllamaService) {}

  @Post('chat')
  async chat(@Body() body: ChatRequestDto) {
    const response = await this.ollamaService.chat(body.prompt);
    return { response };
  }

  @Post('embed')
  async embed(@Body() body: EmbedRequestDto) {
    const vector = await this.ollamaService.embed(body.text);
    return { dimensions: vector.length, preview: vector.slice(0, 10) };
  }
}
