/**
 * Drizzle ORM setup for SQLite.
 */
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as schema from "./schema"; // Import all exports from schema
import { JobRunStatus, JobDefinitionStatus } from "../core/enums"; // Import enums directly

/**
 * Create and export Drizzle DB instance using better-sqlite3.
 */
export function createDb(file: string) {
  const sqlite = new Database(file);
  return drizzle(sqlite);
}

/**
 * DB helper methods for job runs.
 */

export interface JobRunRecord {
  id?: number;
  job_name: string;
  queue_name: string;
  priority: number;
  status: JobRunStatus; // Use enum type
  started_at?: string;
  finished_at?: string;
  output?: string;
  error?: string;
}

export interface JobRecord {
  job_name: string;
  /** Optional initial status */
  status?: JobDefinitionStatus; // Use enum type
  /** Optional automatic reschedule flag */
  reschedule?: boolean;
  /** Optional automatic reschedule delay (ms) */
  reschedule_in?: number | null;
}

export interface ScheduledJobRecord {
  job_name: string;
  next_run: string;
} 

export interface JobDefinitionRecord {
  job_name: string;
  status: JobDefinitionStatus; // Use enum type
  reschedule: boolean;
  reschedule_in: number | null;
}

export class JobDb {
  private readonly sqliteInstance: Database;
  private readonly db: BunSQLiteDatabase<typeof schema>;
  // private readonly tablePrefix: string; // Temporarily remove prefixing logic for simplicity
  private readonly schema: typeof schema;

  /**
   * Constructor for JobDb.
   * @param file - Path to the SQLite database file.
   * @param tablePrefix - Optional prefix for database table names.
   */
  constructor(file: string /*, tablePrefix?: string */) { // Temporarily remove prefixing
    this.sqliteInstance = new Database(file);
    // Cast to any temporarily if schema type causes issues, then refine
    this.db = drizzle(this.sqliteInstance, { schema }); 
    this.schema = schema;
    // this.tablePrefix = tablePrefix || ''; 
    // if (this.tablePrefix) {
    //   console.log(`[DB] Using table prefix: '${this.tablePrefix}'`);
    // }
  }

  /**
   * Insert a new job run.
   * @param run JobRunRecord
   * @returns id of inserted job run
   */
  public async insertJobRun(run: JobRunRecord): Promise<number> {
    console.log(`[DB] Inserting job run:`, run);
    const result = await this.db.insert(this.schema.jobRuns).values(run);
    // Drizzle returns lastInsertRowid for better-sqlite3
    const rid = (result as any).lastInsertRowid;
    console.log(`[DB] Inserted job run with id:`, rid);
    return typeof rid === 'bigint' ? Number(rid) : rid;
  }

  /**
   * Update job run status and metadata.
   * @param id JobRunRecord id
   * @param updates Partial fields to update
   */
  public async updateJobRun(id: number, updates: Partial<JobRunRecord>): Promise<void> {
    console.log(`[DB] Updating job run id ${id} with:`, updates);
    if (Object.keys(updates).length === 0) return;
    await this.db.update(this.schema.jobRuns).set(updates).where(eq(this.schema.jobRuns.id, id));
    console.log(`[DB] Updated job run id ${id}`);
  }

  /**
   * Inserts a new job definition into the database.
   * If a job with the same name already exists, it does nothing.
   */
  public async insertJobDefinition(job: JobDefinitionRecord): Promise<void> {
    console.log("[DB] Inserting job definition:", job);
    await this.db.insert(this.schema.jobs).values(job).onConflictDoNothing();
    console.log(`[DB] Inserted job definition: ${job.job_name}`);
  }

  /**
   * Inserts a new job definition or updates an existing one based on job_name.
   * Updates status, reschedule, and reschedule_in fields on conflict.
   */
  public async upsertJobDefinition(job: JobDefinitionRecord): Promise<void> {
    console.log("[DB] Upserting job definition:", job);
    await this.db.insert(this.schema.jobs).values(job).onConflictDoUpdate({
      target: this.schema.jobs.job_name, // Conflict target
      set: { // Fields to update on conflict
        status: job.status, // Use numeric enum value
        reschedule: job.reschedule,
        reschedule_in: job.reschedule_in,
        // Do not update last_run_at here
      },
    });
    console.log(`[DB] Upserted job definition: ${job.job_name}`);
  }

  /**
   * Updates the status of a specific job definition.
   */
  public async updateJobDefinitionStatus(jobName: string, status: JobDefinitionStatus): Promise<void> { // Use enum type
    console.log(`[DB] Updating job definition status for ${jobName} to ${status}`);
    await this.db.update(this.schema.jobs).set({ status }).where(eq(this.schema.jobs.job_name, jobName));
  }

  /**
   * Upsert a scheduled job (insert or update next_run).
   * @param job ScheduledJobRecord
   */
  public async upsertScheduledJob(job: ScheduledJobRecord): Promise<void> {
    console.log(`[DB] Upserting scheduled job:`, job);
    await this.db
      .insert(this.schema.scheduledJobs)
      .values(job)
      .onConflictDoUpdate({
        target: this.schema.scheduledJobs.job_name,
        set: { next_run: job.next_run }
      });
    console.log(`[DB] Upserted scheduled job:`, job.job_name, '->', job.next_run);
  }

  /**
   * Get all scheduled jobs due to run.
   * @param now ISO string for current time
   * @returns Array of ScheduledJobRecord
   */
  public async getDueScheduledJobs(now: string): Promise<ScheduledJobRecord[]> {
    console.log(`[DB] Querying due scheduled jobs at ${now}`);
    const rows = await this.db
      .select()
      .from(this.schema.scheduledJobs)
      .where(sql`${this.schema.scheduledJobs.next_run} <= ${now}`);
    return rows.map(row => ({
      job_name: row.job_name as string,
      next_run: row.next_run as string,
    }));
  }

  /**
   * Get all scheduled jobs
   */
  public async getAllScheduledJobs(): Promise<ScheduledJobRecord[]> {
    console.log(`[DB] Querying all scheduled jobs`);
    const rows = await this.db.select().from(this.schema.scheduledJobs);
    return rows.map(row => ({
      job_name: row.job_name as string,
      next_run: row.next_run as string,
    }));
  }

  /**
   * Remove a scheduled job (one-time jobs).
   * @param jobName string
   */
  public async removeScheduledJob(jobName: string): Promise<void> {
    console.log(`[DB] Removing scheduled job: ${jobName}`);
    await this.db.delete(this.schema.scheduledJobs).where(eq(this.schema.scheduledJobs.job_name, jobName));
    console.log(`[DB] Removed scheduled job: ${jobName}`);
  }

  /**
   * Get a job definition record from the jobs table.
   */
  public async getJobDefinition(jobName: string): Promise<JobDefinitionRecord> {
    const row = await this.db.select().from(this.schema.jobs).where(eq(this.schema.jobs.job_name, jobName)).get();
    if (!row) {
      throw new Error(`Job definition not found: ${jobName}`);
    }
    // Cast status back to the enum type if needed, though Drizzle should handle integer
    return { 
      ...row, 
      status: row.status as JobDefinitionStatus // Explicit cast if needed
    } as JobDefinitionRecord;
  }

  /**
   * Closes the database connection.
   */
  public closeDb(): void {
    console.log("[DB] Closing database connection...");
    if (this.sqliteInstance) {
      this.sqliteInstance.close();
      console.log("[DB] Database connection closed.");
    } else {
      console.warn("[DB] sqliteInstance not found, cannot close DB.");
    }
  }
}

/**
 * Runs database migrations.
 * @param db - The Drizzle database instance.
 * @param migrationsFolder - Path to the folder containing migration SQL files.
 */
export async function runMigrations(db: BunSQLiteDatabase<typeof schema>, migrationsFolder: string) {
  console.log(`[DB] Running migrations from folder: ${migrationsFolder}`);
  try {
    // Drizzle's migrate function expects an object with a migrationsFolder property
    await migrate(db, { migrationsFolder });
    console.log("[DB] Migrations applied successfully.");
  } catch (error) {
    console.error("[DB] Error applying migrations:", error);
    throw error; // Re-throw to fail the setup if migrations don't apply
  }
}
