// GET  /api/content · contenido publicado desde el administrador (lo ven todos los visitantes).
// POST /api/content · guarda el contenido (solo con sesión del panel). Las fotos se suben antes con /api/upload.
const { K, HttpError, creds, redis, requireAdmin, readBody, send, handler } = require('./_lib/store');

module.exports = handler({
  async GET(req, res) {
    if (!creds()) return send(res, 200, { storage: false, content: null });
    const raw = await redis('GET', K.content);
    let content = null;
    try { content = raw ? JSON.parse(raw) : null; } catch (e) { content = null; }
    send(res, 200, { storage: true, content }, 'public, max-age=0, s-maxage=5, stale-while-revalidate=30');
  },
  async POST(req, res) {
    requireAdmin(req);
    const { content } = await readBody(req, 1.2e6);
    if (!content || typeof content !== 'object' || !content.config) throw new HttpError(400, 'Contenido inválido.');
    const json = JSON.stringify({ ...content, updatedAt: new Date().toISOString() });
    if (json.length > 900000) throw new HttpError(413, 'El contenido es muy pesado. Vuelve a guardar para subir las fotos por separado.');
    await redis('SET', K.content, json);
    send(res, 200, { ok: true });
  },
});
