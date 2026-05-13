import { createReadStream, existsSync, statSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');
const webRoot = path.join(workspaceRoot, 'web');
const port = Number(process.env.PORT || process.argv[2] || 4173);

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const resolved = path.join(webRoot, normalized);
  if (!resolved.startsWith(webRoot)) return null;
  return resolved;
}

createServer((req, res) => {
  const requestPath = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
  let filePath = safePath(requestPath === '/' ? '/index.html' : requestPath);
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!existsSync(filePath)) filePath = path.join(webRoot, 'index.html');

  const ext = path.extname(filePath);
  const headers = {
    'Content-Type': mime.get(ext) || 'application/octet-stream',
    'Cache-Control': requestPath.startsWith('/data/') ? 'public, max-age=3600' : 'no-cache',
  };
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const shouldGzip = /\bgzip\b/.test(acceptEncoding) && ['.json', '.js', '.css', '.html', '.txt'].includes(ext);
  if (shouldGzip) headers['Content-Encoding'] = 'gzip';
  res.writeHead(200, headers);

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500);
    res.end('Read error');
  });
  if (shouldGzip) stream.pipe(createGzip()).pipe(res);
  else stream.pipe(res);
}).listen(port, () => {
  console.log(`Genshin text search: http://localhost:${port}`);
});
