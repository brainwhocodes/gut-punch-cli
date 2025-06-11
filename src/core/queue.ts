/**
 * Priority queue implementation for Gut Punch.
 */
import type { JobDefinition } from "./types";

/**
 * Queue item structure.
 */
export interface QueueItem {
  job: JobDefinition;
  priority: number;
  runId: number;
}

/**
 * PriorityQueue class for Gut Punch.
 */
export class PriorityQueue {
  private readonly items: QueueItem[] = [];

  /** Add a job to the queue. */
  public enqueue(job: JobDefinition, runId: number, priority: number): void {
    const item: QueueItem = { job, runId, priority };
    this.items.push(item);
    this.items.sort((a, b) => a.priority - b.priority); // Sort ascending (lower value = higher priority)
  }

  /** Remove and return the highest priority job. */
  public dequeue(): QueueItem | undefined {
    return this.items.shift();
  }

  /** Get the number of jobs in the queue. */
  public size(): number {
    return this.items.length;
  }
}
