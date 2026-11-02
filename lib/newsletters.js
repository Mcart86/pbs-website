'use strict';
// Newsletter storage + validation shared by the API route.
// Production: Vercel Blob (needs BLOB_READ_WRITE_TOKEN, added automatically when a Blob store is connected).
// Tests only: a local folder (NL_LOCAL_DIR).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const INDEX_PATH = 'newsletters/index.json';
const MAX_PDF_BYTES = 4000000;   // Vercel functions accept request bodies up to 4.5 MB
const MAX_ITEMS = 300;

class HttpError extends Error {
  constructor(status, message, code, missing) { super(message); this.status = status; this.code = code || 'error'; if (missing) this.missing = missing; }
}

function mode() {
  if (process.env.NL_LOCAL_DIR) return 'local';
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  return null;
}
function requireStorage() {
  const m = mode();
  if (!m) throw new HttpError(503, 'Newsletter storage is not set up yet.', 'not_configured', 'storage');
  return m;
}

/* ---------- storage ---------- */
async function readIndex() {
  const m = requireStorage();
  if (m === 'local') {
    const f = path.join(process.env.NL_LOCAL_DIR, 'index.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  }
  const { list } = require('@vercel/blob');
  const { blobs } = await list({ prefix: INDEX_PATH, limit: 5 });
  const hit = blobs.find((b) => b.pathname === INDEX_PATH);
  if (!hit) return [];
  const r = await fetch(hit.url + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new HttpError(502, 'Could not read the newsletter list.');
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
async function writeIndex(items) {
  const m = requireStorage();
  const body = JSON.stringify(items);
  if (m === 'local') { fs.writeFileSync(path.join(process.env.NL_LOCAL_DIR, 'index.json'), body); return; }
  const { put } = require('@vercel/blob');
  await put(INDEX_PATH, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 30 });
}
async function savePdf(name, buffer) {
  const m = requireStorage();
  if (m === 'local') {
    const dir = path.join(process.env.NL_LOCAL_DIR, 'files'); fs.mkdirSync(dir, { recursive: true });
    const fn = crypto.randomBytes(4).toString('hex') + '-' + name + '.pdf';
    fs.writeFileSync(path.join(dir, fn), buffer); return '/__nl/' + fn;
  }
  const { put } = require('@vercel/blob');
  const res = await put('newsletters/' + name + '.pdf', buffer, { access: 'public', addRandomSuffix: true, contentType: 'application/pdf' });
  return res.url;
}
async function removeFile(url) {
  const m = requireStorage();
  if (m === 'local') {
    const fn = String(url).replace('/__nl/', '');
    const f = path.join(process.env.NL_LOCAL_DIR, 'files', path.basename(fn)); if (fs.existsSync(f)) fs.unlinkSync(f); return;
  }
  const { del } = require('@vercel/blob');
  await del(url);
}

/* ---------- validation ---------- */
function cleanText(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function validTitle(t) {
  const v = cleanText(t, 140);
  if (v.length < 3) throw new HttpError(400, 'Please enter a title (at least 3 letters).');
  return v;
}
function validDate(d) {
  const v = cleanText(d, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, 'Please choose a date.');
  const dt = new Date(v + 'T00:00:00Z');
  if (isNaN(dt) || dt.toISOString().slice(0, 10) !== v) throw new HttpError(400, 'That date is not valid.');
  const y = dt.getUTCFullYear(), now = new Date().getUTCFullYear();
  if (y < 2000 || y > now + 1) throw new HttpError(400, 'That date looks wrong. Please check the year.');
  return v;
}
function validSource(s) {
  const v = cleanText(s, 40);
  return v || '';
}
function validUrl(u) {
  let url;
  try { url = new URL(cleanText(u, 600)); } catch (e) { throw new HttpError(400, 'Please paste the full link, starting with https://'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HttpError(400, 'The link must start with https://');
  return url.toString();
}
function validPdf(buf) {
  if (!buf || !buf.length) throw new HttpError(400, 'No file was received. Please choose a PDF.');
  if (buf.length > MAX_PDF_BYTES) throw new HttpError(413, 'That PDF is over 4 MB. Please compress it (for example at ilovepdf.com) and try again.');
  if (buf.slice(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(400, 'That file is not a PDF. Please choose a PDF file.');
}
function slug(s) { return cleanText(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'newsletter'; }

/* ---------- auth ---------- */
function checkPassword(provided) {
  const real = process.env.NEWSLETTER_ADMIN_PASSWORD;
  if (!real) throw new HttpError(503, 'The upload password is not set up yet.', 'not_configured', 'password');
  const a = crypto.createHash('sha256').update(String(provided || '')).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sortItems(items) {
  return items.slice().sort((x, y) => (y.date.localeCompare(x.date)) || ((y.addedAt || '').localeCompare(x.addedAt || '')));
}

module.exports = { HttpError, MAX_PDF_BYTES, MAX_ITEMS, readIndex, writeIndex, savePdf, removeFile,
  validTitle, validDate, validSource, validUrl, validPdf, slug, checkPassword, sleep, sortItems, mode };
