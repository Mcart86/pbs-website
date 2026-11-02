'use strict';
const crypto = require('crypto');
const L = require('../lib/newsletters');

function send(res, status, obj, headers) {
  Object.keys(headers || {}).forEach((k) => res.setHeader(k, headers[k]));
  res.status(status).json(obj);
}
async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'latin1');
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > L.MAX_PDF_BYTES + 8192) throw new L.HttpError(413, 'That PDF is over 4 MB. Please compress it (for example at ilovepdf.com) and try again.');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
async function requireAdmin(req) {
  const ok = L.checkPassword(req.headers['x-admin-password']);
  if (!ok) { await L.sleep(700); throw new L.HttpError(401, "That password isn't right.", 'bad_password'); }
}
const pub = (i) => ({ id: i.id, title: i.title, date: i.date, kind: i.kind, url: i.url, source: i.source || '' });

module.exports = async function handler(req, res) {
  try {
    const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    if (req.method === 'GET') {
      let items = [];
      try { items = L.sortItems(await L.readIndex()); }
      catch (e) { if (!(e instanceof L.HttpError && e.code === 'not_configured')) throw e; } // not set up yet: behave like an empty list
      return send(res, 200, { items: items.map(pub) }, { 'Cache-Control': 'public, max-age=0, s-maxage=30, must-revalidate' });
    }
    if (req.method === 'POST') {
      await requireAdmin(req);
      const kind = q.kind === 'link' ? 'link' : 'pdf';
      const title = L.validTitle(q.title || (req.body && req.body.title));
      const date = L.validDate(q.date || (req.body && req.body.date));
      const source = L.validSource(q.source || (req.body && req.body.source));
      let url, bytes;
      if (kind === 'pdf') {
        const buf = await readBody(req); L.validPdf(buf); bytes = buf.length;
        url = await L.savePdf(date + '-' + L.slug(title), buf);
      } else {
        url = L.validUrl(q.url || (req.body && req.body.url));
      }
      const items = await L.readIndex();
      const item = { id: crypto.randomBytes(6).toString('hex'), title, date, kind, url, source, addedAt: new Date().toISOString() };
      if (bytes) item.bytes = bytes;
      items.push(item);
      await L.writeIndex(L.sortItems(items).slice(0, L.MAX_ITEMS));
      return send(res, 201, { ok: true, item: pub(item) }, { 'Cache-Control': 'no-store' });
    }
    if (req.method === 'DELETE') {
      await requireAdmin(req);
      const id = String(q.id || '');
      const items = await L.readIndex();
      const hit = items.find((i) => i.id === id);
      if (!hit) throw new L.HttpError(404, 'That newsletter was not found.');
      await L.writeIndex(items.filter((i) => i.id !== id));
      if (hit.kind === 'pdf') { try { await L.removeFile(hit.url); } catch (e) { /* file cleanup is best effort */ } }
      return send(res, 200, { ok: true }, { 'Cache-Control': 'no-store' });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e instanceof L.HttpError) return send(res, e.status, { error: e.message, code: e.code, missing: e.missing }, { 'Cache-Control': 'no-store' });
    console.error('newsletters api error:', e && e.message);
    return send(res, 500, { error: 'Something went wrong. Please try again in a moment.' }, { 'Cache-Control': 'no-store' });
  }
};
