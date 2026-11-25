// 로컬 미리보기 서버 (정적 파일 + Vercel /api/* 서버리스 함수 + .env.local 자동 로드)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8404);

// .env.local 로드 (값 출력 없음)
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function decorateRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => {
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  decorateRes(res);
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  let pathname = decodeURIComponent(urlObj.pathname);

  // /s/:game 리라이트
  const shareM = /^\/s\/([^/]+)$/.exec(pathname);
  if (shareM) {
    pathname = '/api/share';
    urlObj.searchParams.set('game', shareM[1]);
  }

  if (pathname.startsWith('/api/')) {
    const rel = pathname.endsWith('.js') ? pathname.slice(1) : `${pathname.slice(1)}.js`;
    const apiPath = path.resolve(__dirname, rel);
    if (!apiPath.startsWith(path.join(__dirname, 'api')) || !fs.existsSync(apiPath)) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    try {
      req.body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      req.body = rawBody;
    }
    req.query = Object.fromEntries(urlObj.searchParams.entries());
    try {
      const mod = await import(pathToFileURL(apiPath).href + `?t=${fs.statSync(apiPath).mtimeMs}`);
      await mod.default(req, res);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
    }
    return;
  }

  let filePath = path.resolve(__dirname, '.' + pathname);
  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`404 Arcade dev server listening on http://127.0.0.1:${PORT}`);
});
