import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BehaviorSubject, map, type Observable } from 'rxjs';

export type IndexingStage =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'completed'
  | 'failed';

export interface IndexingProgress {
  jobId: string;
  stage: IndexingStage;
  processed?: number;
  total?: number;
  indexedChunks?: number;
  error?: string;
}

type IndexingProgressUpdate = Omit<IndexingProgress, 'jobId'>;

@Injectable()
export class IndexingJobService {
  private readonly jobs = new Map<string, BehaviorSubject<IndexingProgress>>();

  create(): string {
    const jobId = randomUUID();
    this.jobs.set(
      jobId,
      new BehaviorSubject<IndexingProgress>({ jobId, stage: 'queued' }),
    );
    return jobId;
  }

  update(jobId: string, update: IndexingProgressUpdate): void {
    this.getJob(jobId).next({ jobId, ...update });
  }

  events(jobId: string): Observable<{ data: IndexingProgress }> {
    return this.getJob(jobId).pipe(map((progress) => ({ data: progress })));
  }

  private getJob(jobId: string): BehaviorSubject<IndexingProgress> {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new NotFoundException('Indexing job not found');
    }

    return job;
  }
}
