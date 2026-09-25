import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.mjs';

const MAX_BODY_BYTES = 20 * 1024 * 1024;

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}

function allowedOrigin(origin) {
  if (!origin) return false;
  if (origin === 'null') return true; // The bundled iPhone WKWebView uses file://.
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

function authorized(request, token) {
  const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) {
      const error = new Error('请求超过 20 MB');
      error.code = 'TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createFitTrackServer({ database, token }) {
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin) {
      if (!allowedOrigin(origin)) return json(response, 403, { error: '此网页来源不允许连接 FitTrack 数据库' });
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.url === '/api/catalog') {
      if (request.method !== 'GET') return json(response, 405, { error: '请求方式不支持' });
      return json(response, 200, { foods: database.readCatalog() });
    }
    if (request.url !== '/api/state') return json(response, 404, { error: '接口不存在' });
    if (!authorized(request, token)) return json(response, 401, { error: '访问密钥无效' });
    try {
      if (request.method === 'GET') return json(response, 200, database.read());
      if (request.method !== 'PUT') return json(response, 405, { error: '请求方式不支持' });
      if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: '需要 JSON 请求' });
      const payload = await readBody(request);
      const revision = database.replace(payload.state, payload.expectedRevision);
      return json(response, 200, { revision });
    } catch (error) {
      const status = error.code === 'CONFLICT' ? 409 : error.code === 'TOO_LARGE' ? 413 : error instanceof SyntaxError ? 400 : 422;
      return json(response, status, { error: error instanceof Error ? error.message : '请求失败' });
    }
  });
}

function accessToken(path) {
  if (process.env.FITTRACK_API_TOKEN) return process.env.FITTRACK_API_TOKEN;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
  return readFileSync(path, 'utf8').trim();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const databasePath = resolve(process.env.FITTRACK_DB_PATH ?? 'data/fittrack.sqlite');
  const host = process.env.FITTRACK_HOST ?? '127.0.0.1';
  const port = Number(process.env.FITTRACK_PORT ?? 8787);
  const token = accessToken(resolve(dirname(databasePath), 'access-token'));
  const database = openDatabase(databasePath);
  const server = createFitTrackServer({ database, token });
  server.listen(port, host, () => {
    console.log(`FitTrack 数据库运行于 http://${host}:${port}`);
    console.log(`访问密钥：${token}`);
    console.log('请仅在可信网络中使用；生产部署需 HTTPS 和正式账号认证。');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); database.close(); process.exit(0); });
}
