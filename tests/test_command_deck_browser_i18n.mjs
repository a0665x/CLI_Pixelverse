import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(new URL('..', import.meta.url).pathname);

test('real browser locale-select rerenders populated production-controller surfaces and open Pixelworld', async () => {
  const server = createServer(async (request, response) => {
    try {
      const path = resolve(root, `.${new URL(request.url, 'http://fixture').pathname}`);
      if (!path.startsWith(`${root}${sep}`) || !(await stat(path)).isFile()) throw new Error('not found');
      response.setHeader('content-type', `${extname(path) === '.mjs' ? 'text/javascript' : 'text/html'}; charset=utf-8`);
      response.end(await readFile(path));
    } catch { response.statusCode = 404; response.end('not found'); }
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const { port } = server.address();
    const { stdout } = await run('chromium', [
      '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--virtual-time-budget=5000', '--dump-dom',
      `http://127.0.0.1:${port}/tests/fixtures/command_deck_locale_harness.html`,
    ], { maxBuffer: 8 * 1024 * 1024 });
    assert.match(stdout, /id="result" data-status="pass"/, stdout.match(/<pre id="result"[\s\S]*?<\/pre>/)?.[0]);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
