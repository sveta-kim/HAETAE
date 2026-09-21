import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root) || relative.split(/[\\/]/).some(p => p.startsWith('.')) || !['index.html', 'src', 'assets'].includes(relative.split(/[\\/]/)[0])) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(`서버 실행 실패: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`HAETAE → http://127.0.0.1:${port}\n종료: Ctrl+C`));
