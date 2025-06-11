import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Define tables directly for Drizzle Kit
export const jobRuns = sqliteTable("job_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  job_name: text("job_name").notNull(),
  queue_name: text("queue_name").notNull(),
  priority: integer("priority").notNull(),
  status: integer("status").notNull(),
  started_at: text("started_at"),
  finished_at: text("finished_at"),
  output: text("output"),
  error: text("error"),
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey(),
  job_name: text("job_name").notNull().unique(),
  status: integer("status").notNull().default(0),
  reschedule: integer("reschedule", { mode: "boolean" }).notNull().default(false),
  reschedule_in: integer("reschedule_in"), // Milliseconds, nullable
  last_run_at: integer("last_run_at", { mode: "timestamp_ms" }),
});

export const scheduledJobs = sqliteTable("scheduled_jobs", {
  job_name: text("job_name").primaryKey(),
  next_run: text("next_run").notNull(),
});

/**
 * Creates the database schema object with an optional table prefix.
 * @param prefix - The prefix to prepend to table names (e.g., 'gp_'). Defaults to empty string.
 * @returns The schema object containing table definitions.
 */
// export function createSchema(prefix: string = '') {
//   const tableName = (name: string): string => `${prefix}${name}`;

//   const _jobRuns = sqliteTable(tableName("job_runs"), {
//     id: integer("id").primaryKey({ autoIncrement: true }),
//     job_name: text("job_name").notNull(),
//     queue_name: text("queue_name").notNull(),
//     priority: integer("priority").notNull(),
//     status: integer("status").notNull(),
//     started_at: text("started_at"),
//     finished_at: text("finished_at"),
//     output: text("output"),
//     error: text("error"),
//   });

//   const _jobs = sqliteTable(tableName("jobs"), {
//     id: integer("id").primaryKey(),
//     job_name: text("job_name").notNull().unique(),
//     status: integer("status").notNull().default(0),
//     reschedule: integer("reschedule", { mode: "boolean" }).notNull().default(false),
//     reschedule_in: integer("reschedule_in"), // Milliseconds, nullable
//     last_run_at: integer("last_run_at", { mode: "timestamp_ms" }),
//   });

//   const _scheduledJobs = sqliteTable(tableName("scheduled_jobs"), {
//     job_name: text("job_name").primaryKey(),
//     next_run: text("next_run").notNull(),
//   });

//   // Return the schema object
//   return { jobRuns: _jobRuns, jobs: _jobs, scheduledJobs: _scheduledJobs };
// }

// Export the type of the generated schema for better type safety elsewhere
// export type GutPunchSchema = ReturnType<typeof createSchema>;