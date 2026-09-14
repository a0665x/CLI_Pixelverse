import { defineConfig } from 'vitest/config';
import {existsSync} from 'node:fs';

export default defineConfig({
  define: {'__LICENSED_OFFICE__':JSON.stringify(existsSync('public/assets/private/modern-office-v1.2/collision-masks.json'))},
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, rolldownOptions: { input: { main: 'index.html', artPreview: 'art-preview.html', honeyPreview: 'honey-preview.html' } } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
