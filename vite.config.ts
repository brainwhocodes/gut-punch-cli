import { defineConfig, type UserConfigExport } from 'vite';
import { resolve, basename } from 'path';
import { globSync } from 'glob';

// Custom Rollup plugin to filter entries for different output formats
function filterEntriesPlugin() {
  return {
    name: 'vite-plugin-filter-entries',
    generateBundle(outputOptions, bundle) {
      const format = outputOptions.format;
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        // Ensure it's an entry chunk and has an original name (facadeModuleId implies it's from an input entry)
        if (chunk.type === 'chunk' && chunk.isEntry && chunk.facadeModuleId) {
          const entryName = chunk.name; // This is the key from rollupOptions.input (e.g., 'jobs/my-job' or 'cli')
          let keep = false;

          if (format === 'es' || format === 'esm') { // For ESM output (jobs)
            if (entryName.startsWith('jobs/')) {
              keep = true;
            }
          } else if (format === 'cjs') { // For CJS output (CLI)
            if (entryName === 'cli') {
              keep = true;
            }
          }

          if (!keep) {
            delete bundle[fileName];
          }
        }
      }
    }
  };
}

// Check if running in Bun environment
const isBun = typeof process !== 'undefined' && process.versions && 'bun' in process.versions;

// Find all .ts files in the src/jobs directory for job entries
const jobFiles = globSync('src/jobs/**/*.ts').reduce((acc, file) => {
  const key = `jobs/${basename(file, '.ts')}`; // Prefix with 'jobs/' for output structure
  acc[key] = resolve(__dirname, file);
  return acc;
}, {} as Record<string, string>);

// CLI entry
const cliEntry = {
  'cli': resolve(__dirname, 'src/cli.ts')
};

// Combined entries
const allEntries = { ...jobFiles, ...cliEntry };

const config: UserConfigExport = defineConfig({
  optimizeDeps: {
    exclude: ['bun:sqlite'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true, // Let this single build manage the dist directory
    sourcemap: true,
    target: isBun ? 'bun' : 'node18', // Target Bun or Node.js environment
    // We can't use build.lib directly for multiple entry types easily. Use rollupOptions.
    rollupOptions: {
      input: allEntries,
      output: [
        // Output for Jobs (ESM)
        {
          dir: 'dist',
          format: 'esm',
          entryFileNames: '[name].mjs', // e.g., jobs/my-job.mjs, cli.mjs (plugin will remove cli.mjs)
          chunkFileNames: 'chunks/[name]-[hash].mjs',
          exports: 'auto',
        },
        // Output for CLI (CJS)
        {
          dir: 'dist',
          format: 'cjs',
          entryFileNames: '[name].cjs', // e.g., jobs/my-job.cjs, cli.cjs (plugin will remove jobs/my-job.cjs)
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          exports: 'auto',
        }
      ],
      // Externalize dependencies that shouldn't be bundled
      external: [
        /^node:.*/, // Node built-in modules (handles fs, path, url, etc.)
        /^bun:.*/, // Add bun:sqlite as external using regex
        'drizzle-orm',
        // 'better-sqlite3', // Removed
        // 'sqlite3', // Removed
        'yaml',
        'commander',
      ],
      treeshake: {
        moduleSideEffects: (id, external) => {
          // Mark all files within src/jobs/ as having side effects
          // to prevent them from being tree-shaken away.
          return id.includes('/src/jobs/');
        },
      },
      preserveEntrySignatures: 'strict',
    },
    minify: false, // Keep builds readable for debugging
  },
  // If jobs or CLI import CSS or other assets, configure plugins here
  plugins: [filterEntriesPlugin()],
});

export default config;
