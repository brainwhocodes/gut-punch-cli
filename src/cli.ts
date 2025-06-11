#!/usr/bin/env bun
/**
 * GutPunch CLI
 * Provides commands to list jobs, queues, upcoming jobs, and run the scheduler as a process.
 *
 * @packageDocumentation
 */
import { GutPunch, Scheduler } from "./index";
import { Job } from "./core/types";
import { PriorityQueue } from "./core/queue";
import { Command, OptionValues } from "commander"; // Added OptionValues
import { findConfigDir } from "../src/config/index"; // Import findConfigDir

/**
 * CLI entry point using Commander
 * @returns {Promise<void>} Completion promise
 */
async function main(): Promise<void> {
  console.log("[CLI] Starting main function...");
  const program: Command = new Command();
  program
    .name('gutpunch')
    .description('Class-first, modular job scheduler for Node')
    .version('0.1.0');
  // Changed option to accept directory, updated description and default
  program.option('-C, --config-dir <dir>', 'Path to config directory (containing gut-punch.config.yaml)', '.');
  
  // Parse options first to determine configDir
  program.parseOptions(process.argv); // Parse only options
  const initialOpts = program.opts();
  let configDirToUse: string;
  const userDir = initialOpts.configDir;
  const isDefault = userDir === '.';
  
  if (userDir && !isDefault) {
      configDirToUse = userDir;
      console.log(`[CLI] Using user-provided config directory: ${configDirToUse}`);
  } else {
      try {
          configDirToUse = findConfigDir(".");
          console.log(`[CLI] Found config directory via search: ${configDirToUse}`);
      } catch (error: any) {
          console.error(`[CLI] Configuration Error: ${error.message}`);
          process.exit(1);
      }
  }
  
  // Now define commands using the determined configDirToUse
  program
      .command('list-jobs')
      .description('List all loaded jobs')
      .action(() => handleListJobs(configDirToUse)); 
  program
      .command('list-queues')
      .description('List all queues and their job counts')
      .action(() => handleListQueues(configDirToUse));
  program
      .command('upcoming')
      .description('List upcoming jobs (next run date)')
      .action(() => handleListUpcoming(configDirToUse));
  program
      .command('run')
      .description('Run the scheduler as a process')
      .action(() => handleRunScheduler(configDirToUse));
      
  // Parse the full command line to execute the correct action
  await program.parseAsync(process.argv); 
}

/**
 * Print help message.
 */
function printHelp(): void {
  console.log(`GutPunch CLI Usage:\n` +
    `  list-jobs      List all loaded jobs\n` +
    `  list-queues    List all queues and their job counts\n` +
    `  upcoming       List upcoming jobs (next run date)\n` +
    `  run            Run the scheduler as a process\n` +
    `  help           Show this help message\n`
  );
}

/**
 * List all loaded jobs.
 */
async function listJobs(scheduler: Scheduler): Promise<void> {
  const jobsDict: Record<string, Job> = (scheduler as any).jobs;
  const jobNames = Object.keys(jobsDict);
  if (jobNames.length === 0) {
    console.log("No jobs loaded.");
    return;
  }
  console.log("\n--- Loaded Jobs ---");
  for (const name of jobNames) {
    console.log(`- ${name}`);
  }
}

/**
 * List all queues and their job counts.
 */
/**
 * Handler for the 'list-queues' command.
 * @param {string} configDir - Path to config directory
 * @returns {Promise<void>} Completion promise
 */
// Renamed parameter to configDir
async function handleListQueues(configDir: string): Promise<void> { 
  const scheduler: Scheduler = new Scheduler(configDir); // Pass configDir
  await scheduler["ensureSchema"]();
  await scheduler["loadJobs"]();
  const queues: Record<string, PriorityQueue> = (scheduler as any).queues;
  console.log("Queues:");
  for (const [name, queue] of Object.entries(queues)) { console.log(`- ${name}: ${queue.size()} jobs`); }
}

/**
 * List upcoming jobs and their next run date.
 */
/**
 * Handler for the 'upcoming' command.
 * @param {string} configDir - Path to config directory
 * @returns {Promise<void>} Completion promise
 */
// Renamed parameter to configDir
async function handleListUpcoming(configDir: string): Promise<void> { 
  const scheduler: Scheduler = new Scheduler(configDir); // Pass configDir
  await scheduler["ensureSchema"]();
  await scheduler["loadJobs"]();
  const db = (scheduler as any).db;
  const rows = await db.getDueScheduledJobs(new Date().toISOString());
  if (!rows || rows.length === 0) { console.log("No upcoming jobs."); return; }
  console.log("\n--- Upcoming Jobs ---");
  for (const { job_name, next_run } of rows) { console.log(`- ${job_name}: next at ${next_run}`); }
}

/**
 * Handler for the 'list-jobs' command.
 * @param {string} configDir - Path to config directory
 * @returns {Promise<void>} Completion promise
 */
// Renamed parameter to configDir
async function handleListJobs(configDir: string): Promise<void> { 
  const scheduler: Scheduler = new Scheduler(configDir); // Pass configDir
  await scheduler["ensureSchema"]();
  await scheduler["loadJobs"]();
  const jobsDict: Record<string, Job> = (scheduler as any).jobs;
  const jobNames: string[] = Object.keys(jobsDict);
  if (jobNames.length === 0) { console.log("No jobs loaded."); return; }
  console.log("\n--- Loaded Jobs ---");
  for (const name of jobNames) { console.log(`- ${name}`); }
}

/**
 * Run the scheduler as a process (blocks and runs jobs).
 */
/**
 * Handler for the 'run' command.
 * @param {string} configDir - Path to config directory
 * @returns {Promise<void>} Completion promise
 */
// Renamed parameter to configDir
async function handleRunScheduler(configDir: string): Promise<void> { 
  const gutPunch: GutPunch = new GutPunch(configDir); // Pass configDir
  await gutPunch.start();
  console.log("GutPunch scheduler started. Press Ctrl+C to exit.");
  // Keep process alive
  process.stdin.resume();
}

main().catch((err) => {
  console.error("[CLI] Unhandled error:", err);
  process.exit(1);
});
