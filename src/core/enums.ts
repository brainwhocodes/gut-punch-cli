/**
 * Enums for core constants.
 */

/**
 * Job Run Statuses
 */
export enum JobRunStatus {
  Pending = 0,
  Running = 1,
  Success = 2,
  Failed = 3,
  Retrying = 4,
}

/**
 * Queue Priorities (Lower value means higher priority)
 */
export enum QueuePriority {
  High = 0,
  Default = 1,
  Low = 2,
}

/**
 * Job Definition Statuses (Used in the 'jobs' table)
 */
export enum JobDefinitionStatus {
  Pending = 0, // Waiting for first schedule
  Active = 1,   // Ready to be scheduled
  Disabled = 2, // Manually disabled
}
