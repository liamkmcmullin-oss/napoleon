import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../src/server.js';
import type { NapoleonServer } from '../src/server.js';

let clientDistDir: string;
let server: NapoleonServer | null = null;
let baseUrl: string;

beforeAll(() => {
  clientDistDir = mkdtempSync(join(tmpdir(), 'napoleon-client-dist-'));
  writeFileSync(join(clientDistDir, 'index.html'), '<!doctype html><title>Napoleon</title>');
  writeFileSync(join(clientDistDir, 'app.js'), 'console.log("hi");');
});

afterAll(() => {
  rmSync(clientDistDir, { recursive: true, force: true });
});

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
});

async function boot(): Promise<void> {
  process.env.CLIENT_DIST_PATH = clientDistDir;
  server = startServer(0);
  await new Promise<void>((resolve) => server!.httpServer.once('listening', () => resolve()));
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('expected a bound TCP address');
  baseUrl = `http://127.0.0.1:${address.port}`;
  delete process.env.CLIENT_DIST_PATH;
}

describe('static client serving', () => {
  it('serves index.html at the root', async () => {
    await boot();
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('Napoleon');
  });

  it('serves a real asset file with the right content type', async () => {
    await boot();
    const res = await fetch(`${baseUrl}/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(await res.text()).toContain('console.log');
  });

  it('falls back to index.html for an unknown path (SPA-style)', async () => {
    await boot();
    const res = await fetch(`${baseUrl}/some/room/code`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Napoleon');
  });

  it('never serves a file outside the client dist root', async () => {
    await boot();
    const res = await fetch(`${baseUrl}/../../../../../../etc/passwd`);
    // Either normalized away by the URL parser or rejected by the handler
    // and SPA-fallen-back — either way, never a raw filesystem read outside root.
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Napoleon');
  });
});
