import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BehaviorSubject, map, type Observable } from 'rxjs';
import type { RagAnswer } from '../domain/rag-answer';
import type { RagSource } from '../domain/rag-answer';

export type RagProgressStage =
  'queued' | 'searching' | 'answering' | 'completed' | 'failed';

export interface RagProgress {
  jobId: string;
  stage: RagProgressStage;
  sources?: RagSource[];
  answer?: RagAnswer;
  error?: string;
}

type RagProgressUpdate = Omit<RagProgress, 'jobId'>;

@Injectable()
export class RagJobService {
  private readonly jobs = new Map<string, BehaviorSubject<RagProgress>>();

  create(): string {
    const jobId = randomUUID();
    this.jobs.set(
      jobId,
      new BehaviorSubject<RagProgress>({ jobId, stage: 'queued' }),
    );
    return jobId;
  }

  update(jobId: string, update: RagProgressUpdate): void {
    this.getJob(jobId).next({ jobId, ...update });
  }

  events(jobId: string): Observable<{ data: RagProgress }> {
    return this.getJob(jobId).pipe(map((progress) => ({ data: progress })));
  }

  private getJob(jobId: string): BehaviorSubject<RagProgress> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new NotFoundException('RAG job not found');
    }

    return job;
  }
}
