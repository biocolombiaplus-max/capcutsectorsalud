// GET /api/img?id=… · fotos subidas desde el administrador (guardadas en Redis).
// Cada foto tiene un id único que nunca cambia, así que el CDN de Vercel la guarda por un año.
const { K, creds, redis, send, handler } = require('./_lib/store');

module.exports = handler({
  async GET(req, res) {
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    if (!/^[a-f0-9]{8,32}$/.test(id) || !creds()) return send(res, 404, { error: 'No encontrada.' });
    const raw = await redis('GET', K.img + id);
    const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(raw || '');
    if (!m) return send(res, 404, { error: 'No encontrada.' });
    res.statusCode = 200;
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(Buffer.from(m[2], 'base64'));
  },
});
