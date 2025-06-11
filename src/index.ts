/**
 * GutPunch main entry point and exported class.
 */
import { Scheduler } from "./core/scheduler.js";
import { dirname } from "node:path"; // For extracting directory from config file path

/**
 * GutPunch class for integration.
 */
export class GutPunch {
  private readonly scheduler: Scheduler;

  /**
   * Construct a GutPunch scheduler.
   * The configuration directory is determined in the following order of precedence:
   * 1. The `configDirOverride` argument if provided.
   * 2. The directory of the file specified in the `GUT_PUNCH_CONFIG` environment variable, if set.
   * 3. Defaults to the current working directory (`.`).
   *
   * @param {string} [configDirOverride] - Optional. Explicitly sets the directory containing the configuration file.
   */
  constructor(configDirOverride?: string) {
    let effectiveConfigDir: string;
    if (configDirOverride) {
      effectiveConfigDir = configDirOverride;
      console.log(`[GutPunch] Using explicit config directory override: ${effectiveConfigDir}`);
    } else if (process.env.GUT_PUNCH_CONFIG) {
      effectiveConfigDir = dirname(process.env.GUT_PUNCH_CONFIG);
      console.log(`[GutPunch] Using config directory from GUT_PUNCH_CONFIG (${process.env.GUT_PUNCH_CONFIG}): ${effectiveConfigDir}`);
    } else {
      effectiveConfigDir = ".";
      console.log(`[GutPunch] Using default config directory: ${effectiveConfigDir}`);
    }
    this.scheduler = new Scheduler(effectiveConfigDir);
  }

  /** Start the scheduler. */
  public async start(): Promise<void> {
    await this.scheduler.start();
  }

  /**
   * Stops the GutPunch scheduler and cleans up resources.
   */
  public stop(): void {
    console.log("[GutPunch] Stopping...");
    if (this.scheduler) {
      this.scheduler.stop();
    }
    console.log("[GutPunch] Stopped.");
  }
}

export { Scheduler } from "./core/scheduler.js";
