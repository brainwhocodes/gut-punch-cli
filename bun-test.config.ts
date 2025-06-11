import { type BunFile } from "bun";
import { resolve } from "path";

/**
 * Bun test configuration
 */
export default {
  // Test environment
  environment: "node",
  
  // Test files to include
  include: ["test/**/*.test.ts"],
  
  // Coverage configuration
  coverage: {
    // Coverage reporters
    reporter: ["text", "html"],
  },
  
  // Timeout for tests in milliseconds
  timeout: 10000,
};
