import type { Job, JobResult, BackoffStrategy } from "gut-punch"; // Import Job interface
import { JobRunStatus } from "gut-punch";

// No more BaseJob, GutPunchConfig, JobDb imports

export class ExampleJob implements Job { // Implement Job
  public readonly name: string = "ExampleJob";
  public readonly maxRetries: number = 3;
  public readonly backoffStrategy: BackoffStrategy = "exponential";
  public readonly reschedule: boolean = true;
  public readonly rescheduleIn: number = 5_000; // 5 seconds

  // No constructor needed for now, or a default one

  public async run(params?: Record<string, unknown>): Promise<JobResult> { // Add optional params
    const now = new Date().toISOString();
    const message = `ExampleJob ran at ${now}. Params: ${JSON.stringify(params || {})}`;
    console.log(`Job log: ${message}`); // Differentiate job's own console logs from the final JSON output
    return {
      status: JobRunStatus.Success,
      output: { message: "Example job finished successfully!", receivedParams: params || {} },
    };
  }
}

// Script execution part (when run via 'bun run example-job.ts')
if (import.meta.main) {
  (async () => {
    let jobParams: Record<string, unknown> | undefined;
    // Basic argument parsing for params (optional)
    // Example: bun run example-job.ts --params='{"foo":"bar"}'
    const paramsArgIndex = process.argv.indexOf('--params');
    if (paramsArgIndex > -1 && process.argv[paramsArgIndex + 1]) {
      try {
        jobParams = JSON.parse(process.argv[paramsArgIndex + 1]);
      } catch (e) {
        console.error("Failed to parse --params argument as JSON:", e);
        // Fallback or exit, for now, we'll proceed without params
      }
    }

    const job = new ExampleJob();
    try {
      const result = await job.run(jobParams);
      process.stdout.write(JSON.stringify(result)); // Output JobResult as JSON
      process.exit(0);
    } catch (error) {
      const result: JobResult = {
        status: JobRunStatus.Failed,
        error: error instanceof Error ? error.message : String(error),
      };
      process.stderr.write(JSON.stringify(result)); // Output error JobResult as JSON to stderr
      process.exit(1);
    }
  })();
}
    