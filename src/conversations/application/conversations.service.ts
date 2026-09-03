import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { RagAnswer, RagSource } from '../../rag/domain/rag-answer';
import type {
  Conversation,
  ConversationMessage,
  MessageRole,
} from '../domain/conversation';

interface PersistedConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PersistedMessage {
  id: string;
  role: string;
  content: string;
  sourcesJson: string | null;
  createdAt: Date;
}

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async begin(
    question: string,
    conversationId?: string,
  ): Promise<Conversation> {
    if (conversationId) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      await this.addMessage(conversation.id, 'user', question);
      return this.toConversation(conversation);
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        title: this.createTitle(question),
        messages: {
          create: { role: 'user', content: question },
        },
      },
    });

    return this.toConversation(conversation);
  }

  async addAnswer(conversationId: string, answer: RagAnswer): Promise<void> {
    await this.addMessage(
      conversationId,
      'assistant',
      answer.answer,
      answer.sources,
    );
  }

  async list(): Promise<Conversation[]> {
    const conversations = await this.prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conversation: PersistedConversation) =>
      this.toConversation(conversation),
    );
  }

  async get(id: string): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      ...this.toConversation(conversation),
      messages: conversation.messages.map((message: PersistedMessage) =>
        this.toMessage(message),
      ),
    };
  }

  private async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    sources?: RagSource[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          role,
          content,
          sourcesJson: sources ? JSON.stringify(sources) : null,
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {},
      }),
    ]);
  }

  private createTitle(question: string): string {
    const normalized = question.replace(/\s+/g, ' ').trim();
    return normalized.length > 80
      ? `${normalized.slice(0, 77).trimEnd()}...`
      : normalized;
  }

  private toConversation(conversation: PersistedConversation): Conversation {
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private toMessage(message: PersistedMessage): ConversationMessage {
    return {
      id: message.id,
      role: message.role as MessageRole,
      content: message.content,
      sources: message.sourcesJson
        ? (JSON.parse(message.sourcesJson) as RagSource[])
        : undefined,
      createdAt: message.createdAt,
    };
  }
}
