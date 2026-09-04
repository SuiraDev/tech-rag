import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export type DependencyStatus = 'up' | 'down';

export interface HealthCheck {
  status: DependencyStatus;
  latencyMs?: number;
  detail?: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  timestamp: string;
  checks: {
    database: HealthCheck;
    qdrant: HealthCheck;
    ollama: HealthCheck;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getMessage(): string {
    return 'Hello World!';
  }

  async check(): Promise<HealthReport> {
    const [database, qdrant, ollama] = await Promise.all([
      this.checkDatabase(),
      this.checkHttp(
        `${this.configService.get('QDRANT_URL', 'http://localhost:6333')}/healthz`,
      ),
      this.checkHttp(
        `${this.configService.get('OLLAMA_URL', 'http://localhost:11434')}/api/tags`,
      ),
    ]);

    const status =
      database.status === 'up' &&
      qdrant.status === 'up' &&
      ollama.status === 'up'
        ? 'ok'
        : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks: { database, qdrant, ollama },
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        detail: error instanceof Error ? error.message : 'Database unreachable',
      };
    }
  }

  private async checkHttp(url: string): Promise<HealthCheck> {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          status: 'down',
          latencyMs: Date.now() - started,
          detail: `HTTP ${response.status}`,
        };
      }

      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        detail: error instanceof Error ? error.message : 'Unreachable',
      };
    }
  }
}
