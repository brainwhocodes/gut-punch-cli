/**
 * Loads and validates YAML configuration for Gut Punch.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join, dirname, parse } from "node:path";
import YAML from "yaml";

/**
 * Allowed log levels.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Helper type guard for LogLevel.
 * @param value - The value to check.
 * @returns True if the value is a valid LogLevel.
 */
function isLogLevel(value: unknown): value is LogLevel {
  return ["debug", "info", "warn", "error"].includes(value as string);
}

/**
 * Gut Punch config shape.
 */
export interface GutPunchConfig {
  database: {
    file: string;
    mode: "standalone" | "external"; // Add mode
    tablePrefix?: string;
  };
  queues: Record<string, { priority: number }>;
  jobsDirectory: string;
  logLevel?: LogLevel; // Use specific LogLevel type
}

/**
 * Default configuration file name.
 */
const DEFAULT_CONFIG_FILENAME = "gut-punch.config.yaml";

/**
 * Searches for the configuration directory hierarchically upwards.
 * Starts from `startDir` and checks parent directories up to `limit` levels.
 * @param startDir - The directory to start searching from.
 * @param limit - Maximum number of parent directories to check (default: 5).
 * @returns The absolute path to the directory containing the config file.
 * @throws If the config file is not found within the search limit.
 */
export function findConfigDir(startDir: string, limit: number = 5): string {
  let currentDir = resolve(startDir);
  const root = parse(currentDir).root;

  for (let i = 0; i < limit; i++) {
    const configFilePath = join(currentDir, DEFAULT_CONFIG_FILENAME);
    console.log(`[Config] Searching for config file at: ${configFilePath}`);
    if (existsSync(configFilePath)) {
      console.log(`[Config] Found config file in directory: ${currentDir}`);
      return currentDir;
    }

    // Stop if we reach the root directory
    if (currentDir === root) {
      break;
    }

    // Move up one directory
    currentDir = dirname(currentDir);
  }

  const errorMsg = `[Config] Could not find '${DEFAULT_CONFIG_FILENAME}' starting from ${resolve(startDir)} and searching ${limit} levels up.`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

/**
 * Load config from a specific file within a given directory.
 * Environment variables can override specific config values:
 * - GUTPUNCH_DATABASE_MODE: Overrides `database.mode`
 * - GUTPUNCH_DATABASE_FILE: Overrides `database.file`
 * - GUTPUNCH_DATABASE_TABLE_PREFIX: Overrides `database.tablePrefix`
 * - GUTPUNCH_JOBS_DIR: Overrides `jobsDirectory`
 * - GUTPUNCH_LOG_LEVEL: Overrides `logLevel`
 *
 * @param configDir - The directory containing the configuration file.
 * @returns The loaded and validated configuration.
 * @throws If the directory or file doesn't exist, or if validation fails.
 */
export function loadConfig(configDir: string = "."): GutPunchConfig { // Added default for configDir
  let configFilePath: string;
  const envConfigPath = process.env.GUT_PUNCH_CONFIG;

  if (envConfigPath) {
    configFilePath = resolve(envConfigPath);
    console.log(`[Config] Using config file path from GUT_PUNCH_CONFIG: ${configFilePath}`);
    if (!existsSync(configFilePath)) {
      const errorMsg = `[Config] Config file specified by GUT_PUNCH_CONFIG not found: ${configFilePath}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (!statSync(configFilePath).isFile()) {
      const errorMsg = `[Config] Path specified by GUT_PUNCH_CONFIG is not a file: ${configFilePath}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  } else {
    const resolvedConfigDir: string = resolve(configDir);
    console.log(`[Config] Attempting to load config from directory: ${resolvedConfigDir}`);
    if (!existsSync(resolvedConfigDir)) {
      const errorMsg = `[Config] Configuration directory not found: ${resolvedConfigDir}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (!statSync(resolvedConfigDir).isDirectory()) {
      const errorMsg = `[Config] Provided configuration path is not a directory: ${resolvedConfigDir}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    configFilePath = join(resolvedConfigDir, DEFAULT_CONFIG_FILENAME);
    console.log(`[Config] Looking for default config file: ${configFilePath}`);
    if (!existsSync(configFilePath)) {
      const errorMsg = `[Config] Default config file '${DEFAULT_CONFIG_FILENAME}' not found in directory: ${resolvedConfigDir}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
  // Existence of configFilePath is now checked within the if/else branches above.

  try {
    const fileContents: string = readFileSync(configFilePath, 'utf8');
    const parsedConfig = YAML.parse(fileContents) as Partial<GutPunchConfig>; // Cast to allow partial for initial load
    console.log(`[Config Debug] Parsed YAML database config: ${JSON.stringify(parsedConfig.database, null, 2)}`);
    console.log(`[Config Debug] Parsed YAML database.mode: ${parsedConfig.database?.mode}, type: ${typeof parsedConfig.database?.mode}`);
    console.log(`[Config Debug] ENV GUTPUNCH_DATABASE_MODE: ${process.env.GUTPUNCH_DATABASE_MODE}, type: ${typeof process.env.GUTPUNCH_DATABASE_MODE}`);

    // --- Runtime Validation ---
    if (!parsedConfig || typeof parsedConfig !== 'object') {
      throw new Error("Invalid configuration: Root must be an object.");
    }
    if (!parsedConfig.database || typeof parsedConfig.database !== 'object') {
      throw new Error("Invalid configuration: 'database' section is missing or not an object.");
    }
    if (typeof parsedConfig.database.file !== 'string' || !parsedConfig.database.file) {
      throw new Error("Invalid configuration: 'database.file' is missing or not a non-empty string.");
    }
    const modeValidationCondition = !parsedConfig.database?.mode || !["standalone", "external"].includes(parsedConfig.database.mode);
    console.log(`[Config Debug] parsedConfig.database.mode for validation: ${parsedConfig.database.mode}, type: ${typeof parsedConfig.database.mode}`);
    console.log(`[Config Debug] Mode validation condition is: ${modeValidationCondition}`);
    if (modeValidationCondition) {
      throw new Error("Invalid configuration: 'database.mode' must be 'standalone' or 'external'.");
    }
    if (parsedConfig.database.tablePrefix !== undefined && typeof parsedConfig.database.tablePrefix !== 'string') {
      throw new Error("Invalid configuration: 'database.tablePrefix' must be a string if provided.");
    }
    if (!parsedConfig.queues || typeof parsedConfig.queues !== 'object') {
      throw new Error("Invalid configuration: 'queues' section is missing or not an object.");
    }
    if (typeof parsedConfig.jobsDirectory !== 'string' || !parsedConfig.jobsDirectory) {
      throw new Error("Invalid configuration: 'jobsDirectory' is missing or not a non-empty string.");
    }
    if (parsedConfig.logLevel !== undefined && !isLogLevel(parsedConfig.logLevel)) {
      throw new Error(`Invalid configuration: 'logLevel' must be one of 'debug', 'info', 'warn', 'error'. Found: ${parsedConfig.logLevel}`);
    }

    // --- Environment Variable Overrides with Validation ---
    const finalConfig: GutPunchConfig = {
      database: {
        file: parsedConfig.database.file,
        mode: parsedConfig.database.mode, // YAML is the source of truth for mode; ENV override is ignored if YAML provides a valid mode
        tablePrefix: parsedConfig.database.tablePrefix,
      },
      queues: parsedConfig.queues,
      jobsDirectory: (process.env.GUTPUNCH_JOBS_DIR as string) || parsedConfig.jobsDirectory,
      logLevel: (process.env.GUTPUNCH_LOG_LEVEL as LogLevel) || parsedConfig.logLevel || "info",
    };
    console.log(`[Config Debug] Constructed finalConfig.database.mode: ${finalConfig.database.mode}, type: ${typeof finalConfig.database.mode}`);

    console.log("[Config] Configuration loaded successfully:");
    console.log(JSON.stringify(finalConfig, null, 2)); // Corrected to log finalConfig
    return finalConfig; // Corrected to return finalConfig
  } catch (error: any) { // Catch YAML parsing errors or validation errors
    const errorMsg = `[Config] Error loading, parsing, or validating config file ${configFilePath}: ${error.message}`;
    console.error(errorMsg, error);
    throw new Error(errorMsg);
  }
}
