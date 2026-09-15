import { defineConfig } from 'vitest/config';
import {existsSync,cpSync,mkdirSync} from 'node:fs';
const pack=process.env.PIXELVERSE_FREE_2D==='1'?'free':process.env.PIXELVERSE_OFFICE_PACK||'free';
if(!['free','modern-office','auto'].includes(pack))throw new Error('PIXELVERSE_OFFICE_PACK must be free, modern-office or auto');
const licensed=existsSync('public/assets/private/modern-office-v1.2/collision-masks.json');
if(pack==='modern-office'&&!licensed)throw new Error('Selected Modern Office pack is missing; install your ZIP or select free');
mkdirSync('public/assets/free-office',{recursive:true});cpSync('../private_assets/free-office/sprites','public/assets/free-office',{recursive:true});

export default defineConfig({
  define: {'__LICENSED_OFFICE__':JSON.stringify(pack!=='free'&&licensed)},
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, rolldownOptions: { input: { main: 'index.html', artPreview: 'art-preview.html', honeyPreview: 'honey-preview.html' } } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
