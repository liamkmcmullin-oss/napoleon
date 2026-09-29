import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Serves the built client (a single-page app with no client-side router —
 * see DECISIONS.md #25) as static files: any path that resolves to a real
 * file under `root` is served as-is; anything else falls back to
 * `index.html`, and anything that tries to escape `root` via `../` is
 * rejected the same way. This only needs to handle plain GETs — the game
 * itself talks over the WebSocket upgrade this shares an http.Server with.
 */
export function createStaticHandler(root: string) {
  const resolvedRoot = resolve(root);
  const indexPath = resolve(resolvedRoot, 'index.html');

  async function fileFor(pathname: string): Promise<string> {
    const decoded = decodeURIComponent(pathname);
    const candidate = resolve(resolvedRoot, '.' + decoded);
    const withinRoot = candidate === resolvedRoot || candidate.startsWith(resolvedRoot + sep);
    if (!withinRoot) return indexPath;

    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
      if (info.isDirectory()) return resolve(candidate, 'index.html');
    } catch {
      // Not a real file — SPA fallback.
    }
    return indexPath;
  }

  return async function handleStaticRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const filePath = await fileFor(url.pathname);
      const data = await readFile(filePath);
      const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  };
}
