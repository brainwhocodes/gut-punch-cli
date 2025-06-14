import { readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, GutPunchConfig, findConfigDir } from "../config/index";
import { JobDb, JobRunRecord } from "../db/drizzle";
import { JobRunStatus, QueuePriority, JobDefinitionStatus } from "./enums";
import { PriorityQueue } from "./queue";
import type { Job, JobDefinition, JobResult } from './types';

export class Scheduler {
  private readonly config: GutPunchConfig;
  private readonly configDir: string;
  private readonly db: JobDb;
  private readonly queues: Record<string, PriorityQueue> = {};
  private readonly jobDefinitions: Record<string, JobDefinition> = {};
  private pollingIntervalId: Timer | null = null;

  constructor(startDir: string = ".") {
    console.log(`[Scheduler] Initializing...`);
    try {
      this.configDir = findConfigDir(startDir);
      this.config = loadConfig(this.configDir);

      if (this.config.database.mode === 'standalone') {
        if (!this.config.database.file) {
          throw new Error("[Scheduler] Database mode is 'standalone' but 'database.file' is missing.");
        }
        console.log(`[Scheduler] Initializing standalone database: ${this.config.database.file}`);
        this.db = new JobDb(this.config.database.file);
      } else {
        throw new Error(`[Scheduler] Unsupported database mode: ${this.config.database.mode}`);
      }

      const queueNames = ['high', 'default', 'low'];
      for (const name of queueNames) {
        this.queues[name] = new PriorityQueue();
      }
      console.log(`[Scheduler] Initialization complete.`);
    } catch (error: any) {
      console.error(`[Scheduler] FATAL: Initialization failed: ${error.message}`);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    await this.loadJobs();
    this.scheduleJobs();
  }

  private async loadJobs(): Promise<void> {
    const jobsDir = resolve(this.configDir, this.config.jobsDirectory);
    console.log(`[Scheduler] Loading jobs from: ${jobsDir}`);

    if (!existsSync(jobsDir)) {
      console.log(`[Scheduler] Jobs directory not found: ${jobsDir}`);
      return;
    }

    const files = readdirSync(jobsDir).filter(f => f.endsWith('.ts'));
    console.log(`[Scheduler] Found job files: ${files.join(', ') || 'None'}`);

    for (const file of files) {
      const filePath = join(jobsDir, file);
      try {
        const moduleUrl = pathToFileURL(filePath).href;
        const jobModule = await import(moduleUrl);
        
        for (const exportName in jobModule) {
          const Exported = jobModule[exportName];
          if (typeof Exported === 'function' && Exported.prototype?.run) {
            const jobInstance: Job = new Exported();
            const jobName = jobInstance.name;

            if (!jobName) {
              console.warn(`[Scheduler] Job from ${file} is missing a 'name' property.`);
              continue;
            }

            const jobDef: JobDefinition = {
              filePath,
              name: jobName,
              queue: (jobInstance as any).queue || 'default',
              reschedule: jobInstance.reschedule ?? false,
              rescheduleIn: jobInstance.rescheduleIn,
              maxRetries: jobInstance.maxRetries,
              backoffStrategy: jobInstance.backoffStrategy,
              runInProcess: (Exported as any).runInProcess ?? false,
              ctor: Exported,
            };

            this.jobDefinitions[jobName] = jobDef;
            await this.db.upsertJobDefinition({
              job_name: jobName,
              status: JobDefinitionStatus.Active,
              reschedule: jobDef.reschedule,
              reschedule_in: jobDef.rescheduleIn ?? null,
            });

            console.log(`[Scheduler] Registered job: ${jobName}`);
            
            if (jobDef.reschedule && typeof jobDef.rescheduleIn === 'number') {
              const nextRunIso = new Date(Date.now() + jobDef.rescheduleIn).toISOString();
              await this.db.upsertScheduledJob({ job_name: jobName, next_run: nextRunIso });
            } else {
              const nextRunIso = new Date().toISOString();
              await this.db.upsertScheduledJob({ job_name: jobName, next_run: nextRunIso });
            }
            break; 
          }
        }
      } catch (error) {
        console.error(`[Scheduler] Error loading job from ${file}:`, error);
      }
    }
    console.log(`[Scheduler] Finished loading. Total jobs registered: ${Object.keys(this.jobDefinitions).length}`);
  }

  private scheduleJobs(): void {
    const loop = async () => {
      await this.pollAndEnqueueJobs().catch(err => console.error("[Scheduler] Error polling jobs:", err));
      for (const queueName of Object.keys(this.queues)) {
        await this.runNextJob(queueName).catch(err => console.error(`[Scheduler] Error running job in queue ${queueName}:`, err));
      }

      // Determine delay until next run
      const nextRunIso = await this.db.getNextScheduledRun();
      let delay = 1000; // default 1s fallback
      if (nextRunIso) {
        const diff = new Date(nextRunIso).getTime() - Date.now();
        delay = Math.max(0, Math.min(diff, 30_000)); // cap at 30s
      }
      setTimeout(loop, delay);
    };
    loop();
  }

  /**
   * Poll for due jobs and enqueue them. Processes up to 50 at a time to
   * reduce DB chatter while keeping latency low. This keeps the logic simple
   * while still batching work.
   */
  private async pollAndEnqueueJobs(): Promise<void> {
    const rows = await this.db.getDueScheduledJobs(new Date().toISOString(), 50);
    for (const row of rows) {
      const jobDef = this.jobDefinitions[row.job_name];
      if (!jobDef) {
        console.error(`[Scheduler] Job definition '${row.job_name}' not found.`);
        continue;
      }
      const queueName = jobDef.queue || "default";
      const priority = this.config.queues[queueName]?.priority ?? QueuePriority.Default;

      const runRecord: JobRunRecord = {
        job_name: row.job_name,
        queue_name: queueName,
        priority,
        status: JobRunStatus.Pending,
      };
      const runId = await this.db.insertJobRun(runRecord);
      this.queues[queueName].enqueue(jobDef, runId, priority);
      console.log(`[Scheduler] Enqueued job ${row.job_name} (runId: ${runId})`);
    }
  }

  private async runNextJob(queueName: string): Promise<void> {
    const queueItem = this.queues[queueName].dequeue();
    if (!queueItem) return;

    const { job: jobDef, runId } = queueItem;
    console.log(`[Scheduler] Running job ${jobDef.name} (runId: ${runId}) from ${jobDef.filePath}`);
    await this.db.updateJobRun(runId, { status: JobRunStatus.Running, started_at: new Date().toISOString() });

    try {
      let result: JobResult;
      if (jobDef.runInProcess) {
        // Execute directly
        const instance = new jobDef.ctor();
        result = await instance.run();
      } else {
        // Execute in subprocess (default)
        const jobProcess = Bun.spawn(['bun', 'run', jobDef.filePath], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const exitCode = await jobProcess.exited;
        const stdout = await new Response(jobProcess.stdout).text();
        const stderr = await new Response(jobProcess.stderr).text();
        if (exitCode === 0) {
          result = JSON.parse(stdout);
        } else {
          throw new Error(`Exit Code ${exitCode}: ${stderr}`);
        }
      }

      await this.db.updateJobRun(runId, {
        status: result.status,
        finished_at: new Date().toISOString(),
        output: result.output ? JSON.stringify(result.output) : undefined,
        error: result.error ?? undefined,
      });

      if (result.status === JobRunStatus.Success && jobDef.reschedule && jobDef.rescheduleIn) {
        const nextRunIso = new Date(Date.now() + jobDef.rescheduleIn).toISOString();
        await this.db.upsertScheduledJob({ job_name: jobDef.name, next_run: nextRunIso });
        console.log(`[Scheduler] Rescheduled job ${jobDef.name}`);
      } else {
        await this.db.removeScheduledJob(jobDef.name);
      }
    } catch (error: any) {
      console.error(`[Scheduler] Job ${jobDef.name} (runId: ${runId}) failed:`, error.message);
      await this.db.updateJobRun(runId, {
        status: JobRunStatus.Failed,
        finished_at: new Date().toISOString(),
        error: error.message,
      });
    }
  }

  public stop(): void {
    console.log("[Scheduler] Stopping scheduler...");
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    if (this.db) {
      this.db.closeDb();
    }
    console.log("[Scheduler] Scheduler stopped.");
  }
}
