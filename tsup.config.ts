import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server/index.ts'],
  outDir: 'server-dist',
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  splitting: false,
  clean: true,
  sourcemap: false,
  // Don't bundle native modules
  external: ['better-sqlite3', 'proxy-agent'],
  // Inline other dependencies
  noExternal: [
    'dotenv', 'express', 'cors', 'axios', 'jsonwebtoken',
    'bcryptjs', 'uuid', '@google/genai', 'ali-oss'
  ],
  banner: {
    js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
    `.trim(),
  },
});
