/* Tiny zero-dependency server for the FLORA cloud archive.
   Start with: node server.js
   Change the shared PIN with: FLORA_PIN=your-pin node server.js */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const PIN = String(process.env.FLORA_PIN || '2457');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'cloud-state.json');
const EMPTY = { profile: {}, clients: [], services: [], invoices: [], draft: null, updatedAt: null };

function readState() {
  try { return Object.assign({}, EMPTY, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); }
  catch (_) { return Object.assign({}, EMPTY); }
}
function writeState(value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}
function send(res, code, body, type='application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Flora-Pin', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
function authorized(req) {
  const supplied = String(req.headers['x-flora-pin'] || '');
  const a = Buffer.from(supplied), b = Buffer.from(PIN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.on('data', chunk => { text += chunk; if (text.length > 80 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(text || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function contentType(file) {
  return file.endsWith('.html') ? 'text/html; charset=utf-8' :
    file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8';
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.url === '/api/state' && ['GET', 'PUT'].includes(req.method)) {
    if (!authorized(req)) return send(res, 401, { error: 'Неверный PIN-код' });
    if (req.method === 'GET') return send(res, 200, readState());
    try {
      const next = await readBody(req);
      const state = Object.assign({}, EMPTY, next, { updatedAt: new Date().toISOString() });
      writeState(state);
      return send(res, 200, state);
    } catch (_) { return send(res, 400, { error: 'Некорректные данные' }); }
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Метод не поддерживается' });
  const requested = decodeURIComponent((req.url || '/').split('?')[0]);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  res.writeHead(200, { 'Content-Type': contentType(file) });
  fs.createReadStream(file).pipe(res);
});
server.listen(PORT, () => console.log(`FLORA running at http://localhost:${PORT} (PIN ${PIN})`));
