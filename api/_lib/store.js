/* Utilidades de las funciones de Vercel (igual que la landing de tiendas de Bio Marketing):
   almacenamiento en Upstash Redis (gratis, se conecta desde Vercel → Storage), sesión del panel y respuestas.
   Los archivos que empiezan por "_" no son rutas. Sin dependencias: solo Node 20+ y la API REST de Upstash. */
const crypto = require('crypto');

const K = { content: 'ccs:content', img: 'ccs:img:' };

// Vercel crea KV_REST_API_URL / KV_REST_API_TOKEN al conectar Upstash; también se aceptan las de Upstash
// o cualquier par *_REST_API_URL / *_REST_API_TOKEN (si al conectar se usó otro prefijo).
function creds() {
  const env = process.env;
  let url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '';
  let token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) {
    const key = Object.keys(env).find((k) => /_REST_API_URL$/.test(k) && env[k.replace(/_URL$/, '_TOKEN')]);
    if (key) { url = env[key]; token = env[key.replace(/_URL$/, '_TOKEN')]; }
  }
  url = String(url).trim().replace(/\/$/, ''); token = String(token).trim();
  return url && token ? { url, token } : null;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const NOT_CONFIGURED = 'El almacenamiento aún no está conectado: conecta Upstash Redis en Vercel → Storage.';
function need() {
  const c = creds();
  if (!c) throw new HttpError(503, NOT_CONFIGURED);
  return c;
}

async function redis(...cmd) {
  const c = need();
  let res;
  try {
    res = await fetch(c.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
      signal: AbortSignal.timeout(9000),
    });
  } catch (e) { throw new HttpError(502, 'No se pudo conectar con la base de datos. Inténtalo de nuevo.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new HttpError(502, res.status === 401 ? 'Upstash rechazó las credenciales: revisa la conexión en Vercel → Storage.' : 'La base de datos respondió con un error' + (data.error ? `: ${data.error}` : '.'));
  return data.result;
}

/* ---------- Sesión del panel ----------
   Token sin estado: vencimiento + firma HMAC con la clave del panel y el token de la base de datos.
   La clave se define con ADMIN_PASSWORD en Vercel (por defecto 123456). */
const SESSION_MS = 12 * 60 * 60 * 1000;
const adminPassword = () => process.env.ADMIN_PASSWORD || '123456';
const tokenKey = () => `${adminPassword()}::${(creds() || {}).token || 'sin-base-de-datos'}`;
const hmac = (s) => crypto.createHmac('sha256', tokenKey()).update(s).digest('hex');
const same = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
function makeToken() { const exp = String(Date.now() + SESSION_MS); return `${exp}.${hmac(exp)}`; }
function requireAdmin(req) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const [exp, sig] = tok.split('.');
  if (!exp || !sig || Number(exp) < Date.now() || !same(sig, hmac(exp))) throw new HttpError(401, 'Tu sesión terminó. Ingresa de nuevo.');
}

/* ---------- HTTP ---------- */
async function readBody(req, max = 1e6) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch (e) { throw new HttpError(400, 'Solicitud inválida.'); } }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > max) throw new HttpError(413, 'Solicitud demasiado grande.'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { throw new HttpError(400, 'Solicitud inválida.'); }
}
function send(res, status, data, cacheHeader) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheHeader || 'no-store');
  res.end(JSON.stringify(data));
}
function handler(methods) {
  return async (req, res) => {
    const fn = methods[req.method];
    if (!fn) { res.setHeader('Allow', Object.keys(methods).join(', ')); return send(res, 405, { error: 'Método no permitido.' }); }
    try { await fn(req, res); } catch (e) {
      const status = e.status || 500;
      if (status >= 500 && status !== 503) console.error('[api]', req.url, e.message);
      send(res, status, { error: e instanceof HttpError ? e.message : 'Error inesperado. Inténtalo de nuevo.', ...(status === 503 ? { code: 'not_configured' } : {}) });
    }
  };
}

module.exports = { K, HttpError, creds, need, redis, adminPassword, same, makeToken, requireAdmin, readBody, send, handler };
