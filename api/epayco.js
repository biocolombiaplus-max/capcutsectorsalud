// POST /api/epayco · crea una sesión de pago de ePayco (Smart Checkout v2), igual que la landing de tiendas virtuales.
// Login con llave pública + privada (solo en el servidor) → sesión de pago → la landing abre el checkout.
// Variables en Vercel: EPAYCO_PUBLIC_KEY (opcional), EPAYCO_PRIVATE_KEY (obligatoria), EPAYCO_TEST (opcional, "true" para pruebas).
// Si falta la llave privada, la landing usa automáticamente el checkout clásico con la llave pública.

// Los precios se calculan aquí: no se confía en el valor que manda el navegador.
// Si cambias precios en el administrador, cámbialos también aquí.
const PLANS = {
  'Individual':    { price: 250000, min: 1 },
  'Equipo Pro':    { price: 210000, min: 3 },
  'Clínica / IPS': { price: 185000, min: 5 },
};
const ANTICIPO = 0.5; // reserva con el 50% (solo plan Individual; las promociones se pagan completas)

const keys = () => ({
  pub: (process.env.EPAYCO_PUBLIC_KEY || '347e56166b7cbd26c7257d8689033fba').trim(),
  priv: (process.env.EPAYCO_PRIVATE_KEY || '').trim(),
  test: /^(1|true|si|sí)$/i.test(process.env.EPAYCO_TEST || ''),
});
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const send = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
};
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 4000) break; }
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

let tokenCache = null;
async function login(k) {
  if (tokenCache && Date.now() - tokenCache.at < 10 * 60000) return tokenCache.token;
  const r = await fetch('https://apify.epayco.co/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${k.pub}:${k.priv}`).toString('base64') },
    body: '{}',
  });
  const d = await r.json().catch(() => ({}));
  if (!d.token) throw Object.assign(new Error('ePayco no aceptó las llaves (' + String(d.textResponse || d.message || d.error || ('HTTP ' + r.status)).slice(0, 100) + ').'), { status: 502 });
  tokenCache = { at: Date.now(), token: d.token };
  return d.token;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido.' });
    const k = keys();
    if (!k.priv) return send(res, 503, { error: 'Falta la variable EPAYCO_PRIVATE_KEY en Vercel.' });
    const b = await readBody(req);
    const plan = PLANS[b.plan];
    if (!plan) return send(res, 400, { error: 'Plan inválido.' });
    const n = Math.max(plan.min, Math.min(60, parseInt(b.personas, 10) || plan.min));
    const promo = b.plan !== 'Individual';
    const full = promo || !!b.full;
    const total = plan.price * n;
    const amount = full ? total : Math.round(total * ANTICIPO);
    const desc = `Curso CapCut Salud - ${b.plan} x${n} - ${full ? 'Pago total' : 'Reserva 50%'}`;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const back = `https://${host}/pago-ok.html`;
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '127.0.0.1';
    const body = {
      test: k.test, ip,
      name: 'Curso CapCut Salud Pro',
      description: desc,
      invoice: 'CCS-' + Date.now(),
      currency: 'COP', amount, taxBase: 0, tax: 0, taxIco: 0,
      country: 'CO', lang: 'ES', checkout_version: '2',
      response: back, confirmation: back,
      extra1: b.plan, extra2: full ? 'total' : 'anticipo', extra3: String(n),
      billing: { email: '', name: clean(b.name, 60), address: 'Colombia', typeDoc: 'CC', numberDoc: '', mobilePhone: String(b.phone || '').replace(/\D/g, '').slice(-10) },
    };
    const create = (token) => fetch('https://apify.epayco.co/payment/session/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body),
    });
    let r = await create(await login(k));
    if (r.status === 401) { tokenCache = null; r = await create(await login(k)); }
    const d = await r.json().catch(() => ({}));
    const sessionId = (d.data && d.data.sessionId) || d.sessionId || '';
    if (!sessionId) return send(res, 502, { error: 'ePayco no pudo crear la sesión de pago: ' + String(d.textResponse || d.message || r.status).slice(0, 120) });
    send(res, 200, { sessionId, test: k.test, amount, description: desc });
  } catch (e) {
    send(res, e.status || 500, { error: e.message || 'Error inesperado.' });
  }
};
