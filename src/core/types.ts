// Import core job types from the gut-punch library
import type { Job, JobResult, BackoffStrategy } from 'gut-punch';

// Re-export for convenience within the CLI project
export type { Job, JobResult, BackoffStrategy };

/**
 * Represents the metadata for a job that the scheduler discovers and manages.
 * This is the internal representation of a job within the CLI, containing
 * information needed to execute it.
 */
export interface JobDefinition {
  /** The absolute path to the job's executable TypeScript file. */
  filePath: string;
  /** The unique name of the job, typically from the job class. */
  name: string;
  /** The queue this job should run in. Defaults to 'default'. */
  queue: string;
  /** Whether to automatically reschedule after completion. */
  reschedule: boolean;
  /** Delay in milliseconds before automatic reschedule. */
  rescheduleIn?: number;
  /** Optional: Max retries. */
  maxRetries?: number;
  /** Optional: Backoff strategy. */
  backoffStrategy?: BackoffStrategy;
}
