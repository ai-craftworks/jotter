'use strict';
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const R = require('../public/render.js');
const VERSION = require('../package.json').version;

const EXT = '.jot';
const PUBLIC = path.join(__dirname, '..', 'public');
const STATIC = new Set(['render.js', 'app.js', 'style.css', 'doc.css']);
const LOOPBACK = ['127.0.0.1', 'localhost', '::1'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jot': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/ogg',
  '.pdf': 'application/pdf', '.zip': 'application/zip',
};
const mimeOf = (f) => MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:", "media-src 'self' data: blob: http: https:",
  "frame-src 'self' https: http: data: blob:", "connect-src 'self'", "font-src 'self' data:",
  "object-src 'none'", "base-uri 'none'", "form-action 'self'",
].join('; ');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const rid = () => crypto.randomBytes(4).toString('hex');
const exists = (p) => fsp.access(p).then(() => true, () => false);
const cleanName = (n) => String(n || '').replace(/[\\/\0]/g, '').trim().replace(/^\.+/, '');
const safeFile = (n) => path.basename(String(n || '')).replace(/[^\w.\-]+/g, '-').replace(/^[.-]+/, '') || 'file';
const J = (s) => JSON.stringify(s).slice(1, -1);

function blankNotebook(title) {
  return {
    format: 'jotter', version: 1, meta: { created: new Date().toISOString() },
    blocks: [{ id: rid(), type: 'markdown', source: '# ' + title + '\n\nStart writing here. Press **Enter** to edit this block, **Shift+Enter** to finish.' }],
  };
}

function normalize(nb) {
  if (!nb || typeof nb !== 'object' || Array.isArray(nb)) throw new HttpError(422, 'This file is not a Jotter notebook.');
  const seen = new Set();
  const blocks = (Array.isArray(nb.blocks) ? nb.blocks : [])
    .filter((b) => b && typeof b === 'object' && typeof b.type === 'string')
    .map((b) => { if (!b.id || seen.has(b.id)) b.id = rid(); seen.add(b.id); return b; });
  return { format: 'jotter', version: 1, meta: Object.assign({}, nb.meta), blocks };
}

async function readBody(req, limit) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > limit) throw new HttpError(413, 'Request too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
async function readJson(req, limit = 64 * 1024 * 1024) {
  const b = await readBody(req, limit);
  try { return b.length ? JSON.parse(b.toString('utf8')) : {}; } catch (e) { throw new HttpError(400, 'Invalid JSON'); }
}

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
function parseCookies(header) {
  const o = {};
  String(header || '').split(/;\s*/).forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) { try { o[c.slice(0, i)] = decodeURIComponent(c.slice(i + 1)); } catch (e) { /* ignore */ } }
  });
  return o;
}

const FORBIDDEN_HTML = '<!doctype html><meta charset="utf-8"><title>Jotter</title><body style="font:16px/1.5 system-ui;max-width:520px;margin:14vh auto;padding:0 20px">' +
  '<h2>Access token needed</h2><p>Open the full link printed in the terminal where you started Jotter. It ends with <code>?token=…</code>.</p></body>';

function createHandler(opts) {
  const ROOT = path.resolve(opts.root);
  const TOKEN = opts.token || null;
  const loopback = LOOPBACK.includes(opts.host);
  const indexHtml = fs.readFileSync(path.join(PUBLIC, 'index.html'));

  const abs = (rel, allowDot) => {
    rel = String(rel || '').replace(/\\/g, '/');
    if (!allowDot && rel.split('/').some((s) => s.length > 1 && s[0] === '.' && s !== '..')) throw new HttpError(404, 'Not found');
    const p = path.resolve(ROOT, '.' + path.sep + rel);
    if (p !== ROOT && !p.startsWith(ROOT + path.sep)) throw new HttpError(403, 'Outside the notebook folder');
    return p;
  };
  const relOf = (p) => path.relative(ROOT, p).split(path.sep).join('/');
  const assetsDir = (nbPath) => path.join(path.dirname(nbPath), path.basename(nbPath, EXT) + '_assets');

  async function uniquePath(dir, stem, ext = '', sep = ' ') {
    let p = path.join(dir, stem + ext);
    for (let i = 1; await exists(p); i++) p = path.join(dir, stem + sep + i + ext);
    return p;
  }

  async function moveAssets(from, to, copy) {
    const a = assetsDir(from), b = assetsDir(to);
    if (!(await exists(a))) return;
    if (copy) await fsp.cp(a, b, { recursive: true });
    else await fsp.rename(a, b);
    const oldN = path.basename(a), newN = path.basename(b);
    if (oldN === newN) return;
    let txt = await fsp.readFile(to, 'utf8');
    txt = txt.split(J(oldN) + '/').join(J(newN) + '/').split(J(encodeURI(oldN)) + '/').join(J(encodeURI(newN)) + '/');
    await fsp.writeFile(to, txt);
  }

  async function readNb(p) {
    if (!p.endsWith(EXT)) throw new HttpError(400, 'Not a Jotter notebook (.jot)');
    let txt;
    try { txt = await fsp.readFile(p, 'utf8'); } catch (e) { throw new HttpError(404, 'Notebook not found'); }
    if (!txt.trim()) return blankNotebook(path.basename(p, EXT));
    try { return normalize(JSON.parse(txt)); } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(422, 'This file is not valid JSON, so it cannot be opened as a notebook.');
    }
  }

  function inlineAsset(baseDir, u) {
    if (!u || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u)) return u;
    let rel;
    try { rel = decodeURIComponent(u.split(/[?#]/)[0]); } catch (e) { return u; }
    const p = rel.startsWith('/') ? path.join(ROOT, rel) : path.resolve(baseDir, rel);
    if (p !== ROOT && !p.startsWith(ROOT + path.sep)) return u;
    const type = mimeOf(p);
    if (!/^image\//.test(type)) return u;
    try {
      const st = fs.statSync(p);
      if (st.size > 12 * 1024 * 1024) return u;
      return 'data:' + type.split(';')[0] + ';base64,' + fs.readFileSync(p).toString('base64');
    } catch (e) { return u; }
  }

  const send = (res, status, body, headers) => {
    res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers));
    res.end(body);
  };
  const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });

  async function serveFile(req, res, file) {
    const st = await fsp.stat(file).catch(() => null);
    if (!st || !st.isFile()) throw new HttpError(404, 'Not found');
    const type = mimeOf(file);
    const h = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Last-Modified': st.mtime.toUTCString() };
    if (/^(?:text\/html|image\/svg|application\/xml|text\/xml)/.test(type)) h['Content-Security-Policy'] = 'sandbox';
    let start = 0, end = st.size - 1, status = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      if (m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], end); } else start = Math.max(0, st.size - +m[2]);
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      status = 206;
      h['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
    }
    h['Content-Length'] = st.size === 0 ? 0 : end - start + 1;
    res.writeHead(status, h);
    if (req.method === 'HEAD' || st.size === 0) return res.end();
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  }

  async function api(req, res, url) {
    const q = (k) => url.searchParams.get(k) || '';
    switch (req.method + ' ' + url.pathname) {
      case 'GET /api/info':
        return json(res, 200, { root: path.basename(ROOT) || ROOT, version: VERSION });

      case 'GET /api/ls': {
        const dir = abs(q('path'));
        const st = await fsp.stat(dir).catch(() => null);
        if (!st || !st.isDirectory()) throw new HttpError(404, 'That folder does not exist.');
        const names = await fsp.readdir(dir);
        const set = new Set(names);
        const items = [];
        for (const name of names) {
          if (name.startsWith('.')) continue;
          if (name.endsWith('_assets') && set.has(name.slice(0, -7) + EXT)) continue;
          const s = await fsp.stat(path.join(dir, name)).catch(() => null);
          if (!s) continue;
          items.push({ name, type: s.isDirectory() ? 'dir' : 'file', kind: name.endsWith(EXT) ? 'notebook' : 'file', size: s.size, mtime: s.mtimeMs });
        }
        return json(res, 200, { path: relOf(dir), items });
      }

      case 'POST /api/new': {
        const b = await readJson(req);
        const dir = abs(b.dir);
        if (b.type === 'folder') {
          const target = await uniquePath(dir, cleanName(b.name) || 'New folder');
          await fsp.mkdir(target);
          return json(res, 200, { path: relOf(target) });
        }
        const stem = (cleanName(b.name) || 'Untitled').replace(/\.jot$/i, '');
        const target = await uniquePath(dir, stem, EXT);
        await fsp.writeFile(target, JSON.stringify(blankNotebook(path.basename(target, EXT)), null, 1));
        return json(res, 200, { path: relOf(target) });
      }

      case 'POST /api/rename': {
        const b = await readJson(req);
        const from = abs(b.path);
        const name = cleanName(b.name);
        if (!name) throw new HttpError(400, 'Enter a name.');
        let to = path.join(path.dirname(from), name);
        if (from.endsWith(EXT) && !to.endsWith(EXT)) to += EXT;
        abs(relOf(to));
        if (to !== from && (await exists(to))) throw new HttpError(409, 'Something with that name already exists.');
        await fsp.rename(from, to);
        if (from.endsWith(EXT)) await moveAssets(from, to, false);
        return json(res, 200, { path: relOf(to) });
      }

      case 'POST /api/duplicate': {
        const b = await readJson(req);
        const from = abs(b.path);
        const st = await fsp.stat(from).catch(() => null);
        if (!st || !st.isFile()) throw new HttpError(400, 'Only files can be duplicated.');
        const ext = path.extname(from);
        const to = await uniquePath(path.dirname(from), path.basename(from, ext) + ' copy', ext);
        await fsp.copyFile(from, to);
        if (ext === EXT) await moveAssets(from, to, true);
        return json(res, 200, { path: relOf(to) });
      }

      case 'POST /api/delete': {
        const b = await readJson(req);
        const p = abs(b.path);
        if (p === ROOT) throw new HttpError(400, 'Cannot delete the root folder.');
        const trash = path.join(ROOT, '.jotter-trash');
        await fsp.mkdir(trash, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        await fsp.rename(p, path.join(trash, stamp + '__' + path.basename(p)));
        if (p.endsWith(EXT)) {
          const a = assetsDir(p);
          if (await exists(a)) await fsp.rename(a, path.join(trash, stamp + '__' + path.basename(a)));
        }
        return json(res, 200, { ok: true });
      }

      case 'GET /api/nb': {
        const p = abs(q('path'));
        const nb = await readNb(p);
        const st = await fsp.stat(p).catch(() => null);
        return json(res, 200, { nb, mtime: st ? st.mtimeMs : 0 });
      }

      case 'PUT /api/nb': {
        const p = abs(q('path'));
        if (!p.endsWith(EXT)) throw new HttpError(400, 'Not a Jotter notebook (.jot)');
        const base = parseFloat(q('base'));
        const st = await fsp.stat(p).catch(() => null);
        if (st && base && st.mtimeMs > base + 5) return json(res, 409, { error: 'This notebook was changed on disk after you opened it.', mtime: st.mtimeMs });
        const nb = normalize(await readJson(req));
        const tmp = p + '.tmp-' + process.pid;
        await fsp.writeFile(tmp, JSON.stringify(nb, null, 1));
        await fsp.rename(tmp, p);
        const st2 = await fsp.stat(p);
        return json(res, 200, { mtime: st2.mtimeMs });
      }

      case 'POST /api/upload': {
        let dir, prefix = '', name;
        if (q('nb')) {
          const nbp = abs(q('nb'));
          dir = assetsDir(nbp);
          prefix = path.basename(dir) + '/';
          name = safeFile(q('name'));
        } else {
          dir = abs(q('dir'));
          name = cleanName(path.basename(q('name'))) || 'file';
        }
        await fsp.mkdir(dir, { recursive: true });
        const ext = path.extname(name);
        const target = await uniquePath(dir, path.basename(name, ext), ext, q('nb') ? '-' : ' ');
        await pipeline(req, fs.createWriteStream(target));
        return json(res, 200, { rel: prefix + path.basename(target), path: relOf(target) });
      }

      case 'GET /api/export': {
        const p = abs(q('path'));
        const nb = await readNb(p);
        const title = path.basename(p, EXT);
        if (q('format') === 'md') {
          const out = path.join(path.dirname(p), title + '.md');
          await fsp.writeFile(out, R.toMarkdown(nb));
          return json(res, 200, { path: relOf(out) });
        }
        if (q('format') === 'html') {
          const css = await fsp.readFile(path.join(PUBLIC, 'doc.css'), 'utf8');
          const html = R.toHtmlDocument(nb, { title, css, resolve: (u) => inlineAsset(path.dirname(p), u) });
          return send(res, 200, html, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(title + '.html'),
          });
        }
        throw new HttpError(400, 'Unknown export format');
      }

      default:
        throw new HttpError(404, 'Unknown endpoint');
    }
  }

  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (loopback) {
        const host = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
        if (!LOOPBACK.includes(host)) throw new HttpError(403, 'Unexpected Host header');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin) {
        let ok = false;
        try { ok = new URL(req.headers.origin).host === req.headers.host; } catch (e) { /* bad origin */ }
        if (!ok) throw new HttpError(403, 'Cross-origin request blocked');
      }
      if (TOKEN) {
        const cookie = 'jotter_' + req.socket.localPort;
        const qt = url.searchParams.get('token');
        if (qt && safeEq(qt, TOKEN)) {
          url.searchParams.delete('token');
          res.writeHead(302, { 'Set-Cookie': cookie + '=' + TOKEN + '; Path=/; HttpOnly; SameSite=Strict', Location: url.pathname + url.search });
          return res.end();
        }
        const have = parseCookies(req.headers.cookie)[cookie];
        if (!have || !safeEq(have, TOKEN)) return send(res, 403, FORBIDDEN_HTML, { 'Content-Type': 'text/html; charset=utf-8' });
      }

      const p = url.pathname;
      if (p.startsWith('/api/')) return await api(req, res, url);
      if (p.startsWith('/files/')) return await serveFile(req, res, abs(decodeURIComponent(p.slice(7))));
      if (p.startsWith('/static/')) {
        const name = decodeURIComponent(p.slice(8));
        if (!STATIC.has(name)) throw new HttpError(404, 'Not found');
        return send(res, 200, await fsp.readFile(path.join(PUBLIC, name)), { 'Content-Type': mimeOf(name), 'Cache-Control': 'no-cache' });
      }
      if (p === '/') { res.writeHead(302, { Location: '/tree/' }); return res.end(); }
      if (p === '/tree' || p.startsWith('/tree/') || p.startsWith('/edit/')) {
        return send(res, 200, indexHtml, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
      }
      throw new HttpError(404, 'Not found');
    } catch (e) {
      const status = e instanceof HttpError ? e.status : e instanceof URIError ? 400 : e && e.code === 'ENOENT' ? 404 : 500;
      if (status === 500) console.error(e);
      if (res.headersSent) return res.destroy();
      json(res, status, { error: status === 500 ? 'Internal error: ' + e.message : e.message });
    }
  };
}

async function start(opts) {
  const handler = createHandler(opts);
  let port = opts.port;
  for (let tries = 0; tries < 50; tries++, port++) {
    const server = http.createServer(handler);
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, opts.host, () => { server.removeListener('error', reject); resolve(); });
      });
      return { server, port };
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
    }
  }
  throw new Error('No free port found near ' + opts.port);
}

module.exports = { start, createHandler };
