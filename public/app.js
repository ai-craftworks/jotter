(() => {
  'use strict';
  const R = window.JotRender;
  let INFO = { root: '' };

  /* ================================================================ helpers */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const dirname = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
  const basename = (p) => p.slice(p.lastIndexOf('/') + 1);
  const stem = (n) => n.replace(/\.[^.]+$/, '');
  const join = (...a) => a.filter(Boolean).join('/');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const pad2 = (n) => String(n).padStart(2, '0');
  const stamp = () => { const d = new Date(); return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()); };
  const fmtSize = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  const ago = (ms) => {
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const normEnc = (s) => s.split('/').map((x) => { try { return encodeURIComponent(decodeURIComponent(x)); } catch (e) { return encodeURIComponent(x); } }).join('/');
  const relative = (from, to) => {
    const a = from ? from.split('/') : [], b = to.split('/');
    let i = 0;
    while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
    return a.slice(i).map(() => '..').concat(b.slice(i)).join('/');
  };

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(2)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }

  const ICONS = {
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M22 8l-6 4 6 4z"/>',
    audio: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    html: '<path d="M4 4h16l-1.5 15L12 21l-6.5-2z"/><path d="M8 9h8M8.5 13H15"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    minus: '<path d="M5 12h14"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    notebook: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    undo: '<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>',
    redo: '<path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>',
    command: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>',
    outline: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  };
  const icon = (n, size = 16) => '<svg class="ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  const logo = (s = 24) => h('span', { html: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="3" fill="var(--brand)"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>' });

  async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.json !== undefined) {
      init.method = opts.method || 'POST';
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.json);
    }
    if (opts.body !== undefined) { init.body = opts.body; if (!opts.method) init.method = 'POST'; }
    let res;
    try { res = await fetch(path, init); } catch (e) { throw new Error('Cannot reach the Jotter server. Is it still running in your terminal?'); }
    let data = null;
    if ((res.headers.get('content-type') || '').includes('json')) data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((data && data.error) || res.statusText || 'Request failed');
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  function toast(msg, kind) {
    const t = h('div', { class: 'toast ' + (kind || '') }, msg);
    $('#toasts').append(t);
    setTimeout(() => t.classList.add('out'), kind === 'error' ? 5000 : 2400);
    setTimeout(() => t.remove(), kind === 'error' ? 5400 : 2800);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' });
      ta.value = text; document.body.append(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { /* ignore */ }
      ta.remove();
      return ok;
    }
  }

  /* ---- modal ---- */
  function modal({ title, body, actions, wide }) {
    return new Promise((resolve) => {
      const close = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(null); } };
      const bodyEl = typeof body === 'function' ? body(close) : body;
      const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close(null); } },
        h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h('div', { class: 'modal-head' }, title),
          h('div', { class: 'modal-body' }, bodyEl),
          h('div', { class: 'modal-foot' }, (actions || []).map((a) =>
            h('button', { class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), onclick: () => close(a.value) }, a.label)))));
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const p = $('.btn.primary', overlay); if (p) { e.preventDefault(); p.click(); } }
      });
      document.addEventListener('keydown', onKey, true);
      document.body.append(overlay);
      const f = $('input,textarea,select', overlay);
      if (f) { f.focus(); if (f.select && f.type === 'text') f.select(); }
    });
  }
  async function promptText(title, value = '', okLabel = 'OK') {
    const input = h('input', { class: 'input', type: 'text', value, spellcheck: 'false' });
    const r = await modal({ title, body: input, actions: [{ label: 'Cancel', value: false }, { label: okLabel, value: true, primary: true }] });
    return r ? input.value.trim() : null;
  }
  const confirmBox = async (title, msg, okLabel = 'OK', danger = false) =>
    !!(await modal({ title, body: h('p', {}, msg), actions: [{ label: 'Cancel', value: false }, { label: okLabel, value: true, primary: true, danger }] }));

  /* ---- dropdown menus ---- */
  let openMenu = null;
  function closeMenus() {
    if (!openMenu) return;
    openMenu.el.remove();
    openMenu.anchor.classList.remove('open');
    document.removeEventListener('mousedown', openMenu.outside, true);
    document.removeEventListener('keydown', openMenu.esc, true);
    openMenu = null;
  }
  function showMenu(anchor, items) {
    if (openMenu && openMenu.anchor === anchor) return closeMenus();
    closeMenus();
    const el = h('div', { class: 'menu', role: 'menu' }, items.map((it) => it.sep ? h('div', { class: 'menu-sep' }) :
      h('button', { class: 'menu-item', role: 'menuitem', disabled: it.disabled, onclick: () => { closeMenus(); it.onClick(); } },
        h('span', { class: 'mi-ico', html: it.icon ? icon(it.icon) : '' }),
        h('span', { class: 'mi-label' }, it.label, it.desc ? h('small', {}, it.desc) : null),
        it.shortcut ? h('kbd', {}, it.shortcut) : null)));
    document.body.append(el);
    const r = anchor.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8)) + 'px';
    let top = r.bottom + 2;
    if (top + el.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - el.offsetHeight - 2);
    el.style.top = top + 'px';
    anchor.classList.add('open');
    const outside = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closeMenus(); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenus(); } };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', esc, true);
    openMenu = { el, anchor, outside, esc };
  }

  /* ---- theme ---- */
  function applyPrefs() {
    const t = lsGet('jot.theme'); if (t) document.documentElement.dataset.theme = t;
    const f = lsGet('jot.font'); if (f) document.documentElement.dataset.font = f;
  }
  const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches));
  function toggleTheme() { const t = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = t; lsSet('jot.theme', t); }
  const themeBtn = () => h('button', { class: 'tbtn', title: 'Toggle dark mode', 'aria-label': 'Toggle dark mode', onclick: toggleTheme, html: icon('moon') });

  /* ================================================================ dashboard */
  async function Dashboard(dir) {
    const root = $('#app');
    document.title = (dir ? basename(dir) : INFO.root) + ' · Jotter';
    let items = [];
    let sort = lsGet('jot.sort') || 'name';
    let query = '';
    const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Folder path' });
    const list = h('div', { class: 'files' });
    const fileInput = h('input', { type: 'file', multiple: true, hidden: true, onchange: () => { uploadFiles(Array.from(fileInput.files)); fileInput.value = ''; } });

    function drawCrumbs() {
      crumbs.replaceChildren(h('a', { href: '/tree/' }, h('span', { html: icon('folder') }), INFO.root));
      let acc = '';
      dir.split('/').filter(Boolean).forEach((seg) => {
        acc = join(acc, seg);
        crumbs.append(h('span', { class: 'sep' }, '/'), h('a', { href: '/tree/' + enc(acc) }, seg));
      });
    }

    async function load() {
      try { items = (await api('/api/ls?path=' + encodeURIComponent(dir))).items; } catch (e) {
        list.replaceChildren(h('div', { class: 'empty' }, h('h3', {}, 'Folder not found'), h('p', {}, e.message)));
        return;
      }
      draw();
    }

    function draw() {
      const q = query.toLowerCase();
      const rows = items.filter((i) => !q || i.name.toLowerCase().includes(q)).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        if (sort === 'modified') return b.mtime - a.mtime;
        if (sort === 'size') return b.size - a.size;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
      const sortBtn = (key, label) => h('button', { class: sort === key ? 'on' : '', onclick: () => { sort = key; lsSet('jot.sort', key); draw(); } }, label);
      list.replaceChildren(h('div', { class: 'f-head' }, sortBtn('name', 'Name'), sortBtn('modified', 'Modified'), sortBtn('size', 'Size'), h('span')));
      if (!rows.length) {
        list.append(h('div', { class: 'empty' },
          h('h3', {}, query ? 'No matches' : 'This folder is empty'),
          h('p', {}, query ? 'Try a different search.' : 'Create a notebook, or drop files here to upload them.')));
        return;
      }
      rows.forEach((it) => list.append(row(it)));
    }

    function row(it) {
      const p = join(dir, it.name);
      const nb = it.kind === 'notebook';
      const href = it.type === 'dir' ? '/tree/' + enc(p) : nb ? '/edit/' + enc(p) : '/files/' + enc(p);
      const name = h('a', { class: 'f-name ' + (it.type === 'dir' ? 'dir' : nb ? 'nb' : ''), href, target: it.type === 'dir' ? null : '_blank', rel: 'noopener' },
        h('span', { html: icon(it.type === 'dir' ? 'folder' : nb ? 'notebook' : 'file', 18) }),
        h('span', { class: 'n' }, nb ? stem(it.name) : it.name, nb ? h('span', { class: 'ext' }, '.jot') : null));
      const act = (ic, title, fn) => h('button', { class: 'tbtn', title, 'aria-label': title, onclick: fn, html: icon(ic) });
      return h('div', { class: 'f-row' }, name,
        h('span', { class: 'f-meta when' }, ago(it.mtime)),
        h('span', { class: 'f-meta size' }, it.type === 'dir' ? '' : fmtSize(it.size)),
        h('div', { class: 'f-actions' },
          act('edit', 'Rename', async () => {
            const n = await promptText('Rename', nb ? stem(it.name) : it.name, 'Rename');
            if (!n || n === (nb ? stem(it.name) : it.name)) return;
            try { await api('/api/rename', { json: { path: p, name: n } }); load(); } catch (e) { toast(e.message, 'error'); }
          }),
          it.type === 'file' ? act('copy', 'Duplicate', async () => { try { await api('/api/duplicate', { json: { path: p } }); load(); } catch (e) { toast(e.message, 'error'); } }) : null,
          it.type === 'file' && !nb ? h('a', { class: 'tbtn', title: 'Download', 'aria-label': 'Download', href: '/files/' + enc(p), download: it.name, html: icon('download') }) : null,
          act('trash', 'Move to trash', async () => {
            const ok = await confirmBox('Move to trash?', '"' + it.name + '" will be moved to the hidden .jotter-trash folder, so you can still recover it.', 'Move to trash', true);
            if (!ok) return;
            try { await api('/api/delete', { json: { path: p } }); toast('Moved to trash'); load(); } catch (e) { toast(e.message, 'error'); }
          })));
    }

    async function newNotebook() {
      try { const r = await api('/api/new', { json: { dir, type: 'notebook' } }); location.href = '/edit/' + enc(r.path); } catch (e) { toast(e.message, 'error'); }
    }
    async function newFolder() {
      const n = await promptText('New folder', 'New folder', 'Create');
      if (!n) return;
      try { await api('/api/new', { json: { dir, type: 'folder', name: n } }); load(); } catch (e) { toast(e.message, 'error'); }
    }
    async function uploadFiles(files) {
      let n = 0;
      for (const f of files) {
        try { await api('/api/upload?dir=' + encodeURIComponent(dir) + '&name=' + encodeURIComponent(f.name), { body: f }); n++; } catch (e) { toast('Could not upload ' + f.name + ': ' + e.message, 'error'); }
      }
      if (n) toast('Uploaded ' + n + (n === 1 ? ' file' : ' files'));
      load();
    }

    const newBtn = h('button', { class: 'btn primary', onclick: () => showMenu(newBtn, [
      { label: 'Notebook', icon: 'notebook', onClick: newNotebook },
      { label: 'Folder', icon: 'folder', onClick: newFolder },
    ]), html: icon('plus') + ' New' });
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Filter files', 'aria-label': 'Filter files', oninput: () => { query = search.value; draw(); } });

    root.replaceChildren(
      h('div', { class: 'chrome' }, h('div', { class: 'topbar' }, h('a', { class: 'brand', href: '/tree/' }, logo(), 'Jotter'), h('span', { class: 'spacer' }), themeBtn())),
      h('main', { class: 'dash', id: 'dash' },
        crumbs,
        h('div', { class: 'dash-bar' }, newBtn,
          h('button', { class: 'btn', onclick: () => fileInput.click(), html: icon('upload') + ' Upload' }), fileInput,
          h('button', { class: 'btn', title: 'Refresh', 'aria-label': 'Refresh', onclick: load, html: icon('refresh') }),
          h('span', { class: 'spacer' }), search),
        list));

    const dash = $('#dash');
    dash.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); dash.classList.add('dragging'); } });
    dash.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dash.classList.remove('dragging'); });
    dash.addEventListener('drop', (e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); dash.classList.remove('dragging'); uploadFiles(Array.from(e.dataTransfer.files)); });
    drawCrumbs();
    await load();
  }

  /* ================================================================ editor */
  const TYPES = {
    markdown: { label: 'Markdown', icon: 'type', desc: 'Rich text written in Markdown', edit: true },
    code: { label: 'Code', icon: 'code', desc: 'Highlighted code, never executed', edit: true },
    image: { label: 'Image', icon: 'image', desc: 'Upload, paste or link a picture', edit: true, keepView: true },
    video: { label: 'Video', icon: 'video', desc: 'A video file, or a YouTube / Vimeo link', edit: true, keepView: true },
    audio: { label: 'Audio', icon: 'audio', desc: 'An audio file or link', edit: true, keepView: true },
    callout: { label: 'Callout', icon: 'info', desc: 'Note, tip or warning box', edit: true },
    todo: { label: 'To-do list', icon: 'check', desc: 'A checklist you can tick off', edit: true },
    table: { label: 'Table', icon: 'table', desc: 'An editable grid', edit: true },
    html: { label: 'HTML', icon: 'html', desc: 'Raw HTML, shown in a sandbox', edit: true, keepView: true },
    embed: { label: 'Embed', icon: 'globe', desc: 'A web page or PDF in a frame', edit: true, keepView: true },
    toc: { label: 'Contents', icon: 'list', desc: 'Table of contents from your headings', edit: false },
    divider: { label: 'Divider', icon: 'minus', desc: 'A horizontal line', edit: false },
  };
  const HINT = {
    markdown: 'Empty text block. Press Enter to start writing.',
    code: 'Empty code block. Press Enter to type or paste code.',
    image: 'No image yet. Press Enter to add one, or drop a file here.',
    video: 'No video yet. Press Enter to add a file or a YouTube link.',
    audio: 'No audio yet. Press Enter to add a file or link.',
    callout: 'Empty callout. Press Enter to write.',
    todo: 'No tasks yet. Press Enter to add some.',
    html: 'Empty HTML block. Press Enter to edit.',
    embed: 'Nothing embedded yet. Press Enter to add a URL.',
  };
  const DEFAULTS = {
    markdown: { source: '' },
    code: { source: '', lang: 'text', filename: '' },
    image: { src: '', alt: '', caption: '', width: 100, align: 'center' },
    video: { src: '', caption: '' },
    audio: { src: '', caption: '' },
    callout: { kind: 'note', title: '', source: '' },
    todo: { items: [{ text: '', done: false }] },
    table: { header: true, rows: [['', '', ''], ['', '', ''], ['', '', '']] },
    html: { source: '', height: 240 },
    embed: { url: '', height: 420 },
    toc: {}, divider: {},
  };
  const newBlock = (type, extra) => Object.assign({ id: uid(), type }, clone(DEFAULTS[type] || {}), extra || {});
  const isEmpty = (b) => {
    switch (b.type) {
      case 'markdown': case 'callout': case 'code': case 'html': return !String(b.source || '').trim();
      case 'image': case 'video': case 'audio': return !b.src;
      case 'embed': return !b.url;
      case 'todo': return !(b.items || []).some((i) => i.text && i.text.trim());
      default: return false;
    }
  };

  /* ---- textarea helpers ---- */
  function typeInto(ta, text) {
    ta.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { /* fall back below */ }
    if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  function replaceRange(ta, s, e, text) {
    ta.setSelectionRange(s, e);
    if (text) typeInto(ta, text);
    else { let ok = false; try { ok = document.execCommand('delete'); } catch (err) { /* fall back */ } if (!ok) { ta.setRangeText('', s, e, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); } }
  }
  function wrapSel(ta, a, b = a) {
    const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
    typeInto(ta, a + sel + b);
    ta.setSelectionRange(s + a.length, e + a.length);
  }
  function indentSel(ta, out) {
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e && !out) return typeInto(ta, '  ');
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let le = v.indexOf('\n', e);
    if (le < 0) le = v.length;
    const block = v.slice(ls, le);
    const next = block.split('\n').map((l) => (out ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l)).join('\n');
    if (next === block) return;
    ta.setSelectionRange(ls, le);
    typeInto(ta, next);
    if (s === e) { const p = Math.max(ls, s + next.length - block.length); ta.setSelectionRange(p, p); } else ta.setSelectionRange(ls, ls + next.length);
  }

  async function Editor(path) {
    const root = $('#app');
    const dir = dirname(path), fileName = basename(path), base = stem(fileName);
    document.title = base + ' · Jotter';
    let nb, mtime = 0;
    try { const r = await api('/api/nb?path=' + encodeURIComponent(path)); nb = r.nb; mtime = r.mtime; } catch (e) {
      root.replaceChildren(h('div', { class: 'err-page' }, h('h2', {}, 'Cannot open this notebook'), h('p', { class: 'muted' }, e.message),
        h('a', { class: 'btn', href: '/tree/' + enc(dir) }, 'Back to files')));
      return;
    }
    if (!nb.blocks.length) nb.blocks.push(newBlock('markdown'));

    const S = { sel: nb.blocks[0].id, editing: null, dirty: false, ver: 0, saving: false, savedAt: Date.now(), history: [], future: [], clip: null, lastD: 0 };
    const prefs = { outline: lsGet('jot.outline') === '1', width: lsGet('jot.width') || 'normal' };
    const doc = h('div', { class: 'doc-col', id: 'doc' });
    const page = h('main', { class: 'page', id: 'page', 'data-width': prefs.width }, doc);
    const outlineEl = h('aside', { id: 'outline', 'aria-label': 'Outline', hidden: !prefs.outline });
    const saveState = h('span', { class: 'save-state' });
    const modeEl = h('span', { class: 'mode' });
    const countEl = h('span', {});
    const saveEl2 = h('span', {});
    const typeSel = h('select', { class: 'sel', title: 'Block type', 'aria-label': 'Block type', onchange: () => convertType(typeSel.value) },
      Object.keys(TYPES).map((t) => h('option', { value: t }, TYPES[t].label)));

    const idx = (id = S.sel) => nb.blocks.findIndex((b) => b.id === id);
    const cur = () => nb.blocks[idx()];
    const cellEl = (id) => doc.querySelector('.cell[data-id="' + id + '"]');
    const snap = () => JSON.stringify(nb.blocks);

    function resolveSrc(u) {
      if (!u || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u)) return u;
      if (u.startsWith('/')) return u.startsWith('/files/') ? u : '/files/' + normEnc(u.slice(1));
      return '/files/' + (dir ? enc(dir) + '/' : '') + normEnc(u);
    }
    const ctx = { resolve: resolveSrc, headings: () => R.collectHeadings(nb.blocks), live: true };

    /* ---- history ---- */
    function checkpoint() {
      const s = snap();
      if (S.history[S.history.length - 1] !== s) { S.history.push(s); if (S.history.length > 80) S.history.shift(); }
      S.future = [];
    }
    function restore(json) {
      exitEdit();
      nb.blocks = JSON.parse(json);
      if (!nb.blocks.length) nb.blocks.push(newBlock('markdown'));
      if (idx() < 0) S.sel = nb.blocks[0].id;
      dirty(); renderAll();
    }
    function undo() {
      const now = snap();
      let prev = null;
      while (S.history.length) { const p = S.history.pop(); if (p !== now) { prev = p; break; } }
      if (!prev) return toast('Nothing to undo');
      S.future.push(now); restore(prev);
    }
    function redo() {
      const now = snap();
      let next = null;
      while (S.future.length) { const p = S.future.pop(); if (p !== now) { next = p; break; } }
      if (!next) return toast('Nothing to redo');
      S.history.push(now); restore(next);
    }

    /* ---- saving ---- */
    function dirty() { S.dirty = true; S.ver++; status(); }
    function status() {
      saveState.textContent = S.saving ? 'Saving…' : S.dirty ? 'Unsaved changes' : 'Saved ' + ago(S.savedAt);
      saveState.classList.toggle('unsaved', S.dirty && !S.saving);
      saveEl2.textContent = S.saving ? 'Saving…' : S.dirty ? 'Unsaved' : 'Saved';
      modeEl.className = 'mode' + (S.editing ? ' edit' : '');
      modeEl.replaceChildren(h('i'), S.editing ? 'Edit mode' : 'Command mode');
    }
    const stats = debounce(() => { countEl.textContent = R.wordCount(nb).toLocaleString() + ' words · ' + nb.blocks.length + ' blocks'; }, 250);
    async function save(manual) {
      if (S.saving || (!S.dirty && !manual)) return;
      S.saving = true; status();
      const ver = S.ver;
      try {
        nb.meta = Object.assign(nb.meta || {}, { modified: new Date().toISOString() });
        const r = await api('/api/nb?path=' + encodeURIComponent(path) + '&base=' + mtime, { method: 'PUT', json: nb });
        mtime = r.mtime; S.savedAt = Date.now();
        if (S.ver === ver) S.dirty = false;
        if (manual) toast('Saved');
      } catch (e) {
        if (e.status === 409) {
          const ok = await confirmBox('Notebook changed on disk', 'Another program (or another tab) saved this notebook after you opened it. Overwrite it with what you see here?', 'Overwrite', true);
          if (ok) { mtime = e.data.mtime; S.saving = false; await save(true); }
        } else toast('Could not save: ' + e.message, 'error');
      } finally { S.saving = false; status(); }
    }

    /* ---- uploads ---- */
    async function uploadAsset(file) {
      let n = file.name || '';
      if (!n || /^image\.(png|jpe?g|gif|webp)$/i.test(n)) n = 'pasted-' + stamp() + '.' + ((file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/\+.*/, ''));
      return api('/api/upload?nb=' + encodeURIComponent(path) + '&name=' + encodeURIComponent(n), { body: file });
    }
    async function addFiles(files) {
      for (const f of files) {
        try {
          const r = await uploadAsset(f);
          const t = f.type.split('/')[0];
          if (t === 'image') insertBlock('image', 'below', { src: r.rel, alt: stem(f.name || '') }, false);
          else if (t === 'video') insertBlock('video', 'below', { src: r.rel }, false);
          else if (t === 'audio') insertBlock('audio', 'below', { src: r.rel }, false);
          else insertBlock('markdown', 'below', { source: '[' + (f.name || r.rel) + '](' + encodeURI(r.rel) + ')' }, false);
        } catch (e) { toast('Upload failed: ' + e.message, 'error'); }
      }
    }
    async function pickFile(kind) {
      const exts = { image: /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i, video: /\.(mp4|webm|ogv|mov|m4v|mkv)$/i, audio: /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)$/i, embed: /\.(html?|pdf)$/i }[kind] || /./;
      let cwd = dir, done = () => {};
      const crumb = h('div', { class: 'picker-path' });
      const list = h('div', { class: 'picker' });
      const load = async () => {
        let r;
        try { r = await api('/api/ls?path=' + encodeURIComponent(cwd)); } catch (e) { list.replaceChildren(h('p', { class: 'muted' }, e.message)); return; }
        crumb.textContent = '/' + cwd;
        const rows = r.items.filter((i) => i.type === 'dir' || exts.test(i.name)).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
        list.replaceChildren(...[
          cwd ? h('button', { class: 'pick-row', onclick: () => { cwd = dirname(cwd); load(); } }, h('span', { html: icon('folder') }), '..') : null,
          ...rows.map((i) => (i.type === 'dir'
            ? h('button', { class: 'pick-row', onclick: () => { cwd = join(cwd, i.name); load(); } }, h('span', { html: icon('folder') }), i.name)
            : h('button', { class: 'pick-row', onclick: () => done(relative(dir, join(cwd, i.name))) }, h('span', { html: icon('file') }), i.name, h('small', {}, fmtSize(i.size))))),
          !rows.length ? h('p', { class: 'muted pad' }, 'No matching files in this folder.') : null,
        ].filter(Boolean));
      };
      return modal({ title: 'Choose a file', wide: true, body: (close) => { done = close; load(); return h('div', {}, crumb, list); }, actions: [{ label: 'Cancel', value: null }] });
    }

    /* ---- selection & modes ---- */
    function selectUI(scroll) {
      $$('.cell.selected', doc).forEach((c) => c.classList.remove('selected'));
      const el = cellEl(S.sel);
      if (!el) return;
      el.classList.add('selected');
      const b = cur();
      if (b) typeSel.value = b.type;
      if (scroll) el.scrollIntoView({ block: 'nearest' });
    }
    function select(id, scroll) { if (idx(id) >= 0) { S.sel = id; selectUI(scroll); } }
    function selectRel(d) {
      const i = Math.max(0, Math.min(nb.blocks.length - 1, idx() + d));
      select(nb.blocks[i].id, true);
      const el = cellEl(S.sel); if (el) el.focus({ preventScroll: true });
    }
    function selectNext(create) {
      const i = idx();
      if (i < nb.blocks.length - 1) return selectRel(1);
      if (create) insertBlock('markdown', 'below');
    }

    /* ---- block views ---- */
    function renderView(el, b) {
      const view = $('.view', el);
      view.innerHTML = isEmpty(b) && HINT[b.type] ? '<div class="placeholder">' + HINT[b.type] + '</div>' : R.blockHtml(b, ctx);
      $$('.codeblock', view).forEach((box) => {
        box.append(h('button', { class: 'copy-btn', title: 'Copy code', 'aria-label': 'Copy code', html: icon('copy', 14),
          onclick: async (e) => { e.stopPropagation(); toast((await copyText($('pre', box).innerText)) ? 'Copied' : 'Copy failed'); } }));
      });
      $$('.todo input[type=checkbox]', view).forEach((cb) => cb.addEventListener('change', () => {
        checkpoint(); b.items[+cb.dataset.i].done = cb.checked; cb.closest('li').classList.toggle('done', cb.checked); dirty();
      }));
      $$('.toc a', view).forEach((a) => a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const t = document.getElementById(a.getAttribute('href').slice(1));
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
    }
    function refreshTocs() { nb.blocks.filter((b) => b.type === 'toc').forEach((b) => { const el = cellEl(b.id); if (el) renderView(el, b); }); }
    function refreshBlock(id) { const el = cellEl(id), b = nb.blocks[idx(id)]; if (el && b) renderView(el, b); }

    function blockEl(b) {
      const T = TYPES[b.type] || TYPES.markdown;
      const tool = (ic, title, fn) => h('button', { class: 'tbtn', title, 'aria-label': title, html: icon(ic, 15), onclick: (e) => { e.stopPropagation(); select(b.id); fn(); } });
      const el = h('div', { class: 'cell t-' + b.type, 'data-id': b.id, tabindex: '-1' },
        h('div', { class: 'gutter', title: T.label, html: icon(T.icon) }),
        h('div', { class: 'cell-main' }, h('div', { class: 'view' }), h('div', { class: 'editor', hidden: true })),
        h('div', { class: 'cell-tools' },
          tool('up', 'Move up', () => moveBlock(-1)), tool('down', 'Move down', () => moveBlock(1)),
          tool('copy', 'Duplicate', duplicateBlock), tool('trash', 'Delete block', deleteBlock)));
      const view = $('.view', el);
      view.addEventListener('dblclick', (e) => { if (!e.target.closest('video,audio,a,input,iframe')) enterEdit(b.id); });
      view.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.classList.add('broken'); }, true);
      renderView(el, b);
      return el;
    }

    function adder(index) {
      return h('div', { class: 'adder' }, h('button', { class: 'adder-btn', title: 'Add a block here', 'aria-label': 'Add a block here', html: icon('plus', 13),
        onclick: (e) => showMenu(e.currentTarget, typeItems((t) => insertAt(index, t))) }));
    }
    function typeItems(pick) { return Object.keys(TYPES).map((t) => ({ label: TYPES[t].label, desc: TYPES[t].desc, icon: TYPES[t].icon, onClick: () => pick(t) })); }

    function renderAll() {
      S.editing = null;
      const frag = document.createDocumentFragment();
      nb.blocks.forEach((b, i) => { frag.append(adder(i), blockEl(b)); });
      frag.append(h('div', { class: 'add-row' }, ['markdown', 'code', 'image', 'video', 'callout', 'table', 'todo'].map((t) =>
        h('button', { class: 'btn', onclick: () => insertAt(nb.blocks.length, t), html: icon(TYPES[t].icon, 14) + ' ' + TYPES[t].label }))));
      doc.replaceChildren(frag);
      selectUI(false); refreshOutline(); stats(); status();
    }

    /* ---- structure ops ---- */
    function insertAt(index, type, extra, edit = true) {
      exitEdit(); checkpoint();
      const b = newBlock(type, extra);
      nb.blocks.splice(index, 0, b);
      S.sel = b.id; dirty(); renderAll();
      const el = cellEl(b.id);
      if (edit && TYPES[type].edit) enterEdit(b.id); else if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
      return b;
    }
    const insertBlock = (type, where = 'below', extra, edit) => insertAt(where === 'above' ? idx() : idx() + 1, type, extra, edit);
    function deleteBlock() {
      exitEdit(); checkpoint();
      const i = idx();
      nb.blocks.splice(i, 1);
      if (!nb.blocks.length) nb.blocks.push(newBlock('markdown'));
      S.sel = nb.blocks[Math.min(i, nb.blocks.length - 1)].id;
      dirty(); renderAll();
      const el = cellEl(S.sel); if (el) el.focus({ preventScroll: true });
    }
    function moveBlock(d) {
      const i = idx(), j = i + d;
      if (j < 0 || j >= nb.blocks.length) return;
      const keep = S.editing; exitEdit(); checkpoint();
      [nb.blocks[i], nb.blocks[j]] = [nb.blocks[j], nb.blocks[i]];
      dirty(); renderAll();
      const el = cellEl(S.sel); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
      if (keep) enterEdit(S.sel);
    }
    function copyBlock() { S.clip = clone(cur()); toast('Block copied'); }
    function cutBlock() { copyBlock(); deleteBlock(); }
    function pasteBlock(above) {
      if (!S.clip) return toast('Nothing to paste. Copy a block first.');
      const c = clone(S.clip); c.id = uid();
      exitEdit(); checkpoint();
      nb.blocks.splice(above ? idx() : idx() + 1, 0, c);
      S.sel = c.id; dirty(); renderAll();
    }
    function duplicateBlock() {
      exitEdit(); checkpoint();
      const c = clone(cur()); c.id = uid();
      nb.blocks.splice(idx() + 1, 0, c);
      S.sel = c.id; dirty(); renderAll();
    }
    function convertType(type) {
      const old = cur();
      if (!old || old.type === type) return;
      exitEdit(); checkpoint();
      const b = newBlock(type, { id: old.id });
      if ('source' in old && 'source' in b) b.source = old.source;
      nb.blocks[idx()] = b;
      dirty(); renderAll();
      const el = cellEl(S.sel); if (el) el.focus({ preventScroll: true });
    }
    function setHeading(n) {
      const b = cur();
      if (!b || b.type !== 'markdown') return;
      checkpoint();
      const lines = String(b.source || '').split('\n');
      lines[0] = (n ? '#'.repeat(n) + ' ' : '') + lines[0].replace(/^#{1,6}\s*/, '');
      b.source = lines.join('\n');
      dirty(); refreshBlock(b.id); refreshOutline(); refreshTocs(); stats();
    }
    function splitBlock() {
      const b = cur();
      const ta = S.editing && $('.editor textarea', cellEl(b.id));
      if (!ta || !('source' in b)) return toast('Put the cursor inside a text or code block to split it.');
      const pos = ta.selectionStart;
      const before = b.source.slice(0, pos).replace(/\s+$/, ''), after = b.source.slice(pos).replace(/^\s+/, '');
      exitEdit(); checkpoint();
      b.source = before;
      const nbk = Object.assign(clone(b), { id: uid(), source: after });
      nb.blocks.splice(idx() + 1, 0, nbk);
      S.sel = nbk.id; dirty(); renderAll();
      enterEdit(nbk.id, { start: true });
    }
    function mergeBelow() {
      const i = idx(), b = nb.blocks[i], n = nb.blocks[i + 1];
      if (!n || n.type !== b.type || !('source' in b)) return toast('Merging works between two neighbouring text or code blocks of the same type.');
      exitEdit(); checkpoint();
      b.source = (b.source || '') + (b.type === 'code' ? '\n' : '\n\n') + (n.source || '');
      nb.blocks.splice(i + 1, 1);
      dirty(); renderAll();
    }

    /* ---- edit mode ---- */
    function enterEdit(id, o) {
      select(id);
      const b = cur();
      if (!b || !TYPES[b.type].edit) return;
      if (S.editing === id) return;
      if (S.editing) exitEdit();
      checkpoint();
      S.editing = id;
      const el = cellEl(id);
      const e = EDITORS[b.type](b, el);
      const ed = $('.editor', el);
      ed.replaceChildren(e.node); ed.hidden = false;
      $('.view', el).hidden = !TYPES[b.type].keepView;
      el.classList.add('editing');
      status();
      e.focus(o || {});
      el.scrollIntoView({ block: 'nearest' });
    }
    function exitEdit() {
      if (!S.editing) return;
      const id = S.editing;
      S.editing = null;
      const el = cellEl(id), b = nb.blocks[idx(id)];
      if (el && b) {
        const ed = $('.editor', el);
        ed.hidden = true; ed.replaceChildren();
        $('.view', el).hidden = false;
        el.classList.remove('editing');
        renderView(el, b);
        refreshTocs(); refreshOutline();
        el.focus({ preventScroll: true });
      }
      status();
    }

    /* ---- editors ---- */
    const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 64) + 'px'; };
    const focusEnd = (ta, o) => { ta.focus(); const n = o && o.start ? 0 : ta.value.length; ta.setSelectionRange(n, n); fit(ta); };

    function mdKeys(ta, withImages) {
      ta.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && !e.shiftKey && !e.altKey) {
          const k = e.key.toLowerCase();
          if (k === 'b') { e.preventDefault(); wrapSel(ta, '**'); } else if (k === 'i') { e.preventDefault(); wrapSel(ta, '*'); }
          return;
        }
        if (e.key === 'Tab' && !mod && !e.altKey) { e.preventDefault(); indentSel(ta, e.shiftKey); return; }
        if (e.key === 'Enter' && !e.shiftKey && !mod && !e.altKey) {
          const pos = ta.selectionStart;
          if (pos !== ta.selectionEnd) return;
          const ls = ta.value.lastIndexOf('\n', pos - 1) + 1;
          const line = ta.value.slice(ls, pos);
          const m = line.match(/^(\s*)((?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|>\s?)(.*)$/);
          if (!m) return;
          e.preventDefault();
          if (!m[3].trim()) { replaceRange(ta, ls, pos, ''); return; }
          const next = m[1] + m[2].replace(/^(\d+)([.)])/, (a, n, d) => (+n + 1) + d).replace(/\[[xX]\]/, '[ ]');
          typeInto(ta, '\n' + next);
        }
      });
      if (withImages) ta.addEventListener('paste', (e) => {
        const cd = e.clipboardData;
        if (!cd) return;
        const imgs = Array.from(cd.files || []).filter((f) => f.type.startsWith('image/'));
        if (imgs.length) {
          e.preventDefault();
          imgs.forEach(async (f) => {
            try { const r = await uploadAsset(f); typeInto(ta, '![](' + encodeURI(r.rel) + ')\n'); } catch (err) { toast('Upload failed: ' + err.message, 'error'); }
          });
          return;
        }
        const txt = (cd.getData('text/plain') || '').trim();
        if (/^https?:\/\/\S+$/.test(txt) && ta.selectionStart !== ta.selectionEnd) {
          e.preventDefault();
          typeInto(ta, '[' + ta.value.slice(ta.selectionStart, ta.selectionEnd) + '](' + txt + ')');
        }
      });
    }
    function textArea(b, field, placeholder, md = true) {
      const ta = h('textarea', { class: 'ta', spellcheck: 'true', placeholder, rows: '3' });
      ta.value = b[field] || '';
      ta.addEventListener('input', () => { b[field] = ta.value; fit(ta); dirty(); stats(); });
      if (md) mdKeys(ta, true);
      requestAnimationFrame(() => fit(ta));
      return ta;
    }
    const field = (props) => h('input', Object.assign({ class: 'input slim' }, props));

    function mediaEditor(b, el, kind) {
      const refresh = debounce(() => renderView(el, b), 200);
      const src = field({ class: 'input grow', placeholder: kind === 'video' ? 'Path or URL (YouTube and Vimeo links work)' : 'Path or URL', value: b.src || '', 'aria-label': 'Source',
        oninput: () => { b.src = src.value.trim(); dirty(); refresh(); } });
      const set = (v) => { b.src = v; src.value = v; dirty(); renderView(el, b); };
      const file = h('input', { type: 'file', hidden: true, accept: kind + '/*', onchange: async () => {
        const f = file.files[0]; file.value = '';
        if (!f) return;
        try { set((await uploadAsset(f)).rel); } catch (e) { toast('Upload failed: ' + e.message, 'error'); }
      } });
      const rows = [h('div', { class: 'ed-row' }, src,
        h('button', { class: 'btn', onclick: () => file.click() }, 'Upload…'),
        h('button', { class: 'btn', onclick: async () => { const p = await pickFile(kind); if (p) set(p); } }, 'Browse folder…'), file)];
      if (kind === 'image') {
        const alt = field({ class: 'input grow', placeholder: 'Alt text (describes the image)', value: b.alt || '', 'aria-label': 'Alt text', oninput: () => { b.alt = alt.value; dirty(); refresh(); } });
        const val = h('span', {}, (b.width || 100) + '%');
        const range = h('input', { type: 'range', min: '10', max: '100', step: '5', value: String(b.width || 100), 'aria-label': 'Width',
          oninput: () => { b.width = +range.value; val.textContent = range.value + '%'; dirty(); refresh(); } });
        const align = h('select', { class: 'sel', 'aria-label': 'Alignment', onchange: () => { b.align = align.value; dirty(); refresh(); } },
          ['left', 'center', 'right'].map((a) => h('option', { value: a, selected: (b.align || 'center') === a }, a[0].toUpperCase() + a.slice(1))));
        rows.push(h('div', { class: 'ed-row' }, alt, h('label', { class: 'inline' }, 'Width', range, val), align));
      }
      const cap = field({ class: 'input grow', placeholder: 'Caption (optional, Markdown works)', value: b.caption || '', 'aria-label': 'Caption', oninput: () => { b.caption = cap.value; dirty(); refresh(); } });
      rows.push(h('div', { class: 'ed-row' }, cap));
      return { node: h('div', { class: 'ed-stack' }, rows), focus: () => src.focus() };
    }

    const EDITORS = {
      markdown(b) {
        const ta = textArea(b, 'source', 'Write Markdown: # Heading, **bold**, - list, > quote, ``` code. Paste images to insert them.');
        return { node: ta, focus: (o) => focusEnd(ta, o) };
      },
      code(b) {
        const lang = h('select', { class: 'sel', title: 'Language', 'aria-label': 'Language', onchange: () => { b.lang = lang.value; paint(); dirty(); } },
          R.LANGS.map((l) => h('option', { value: l, selected: (b.lang || 'text') === l }, l)));
        const fn = field({ placeholder: 'File name (optional)', value: b.filename || '', 'aria-label': 'File name', oninput: () => { b.filename = fn.value; dirty(); } });
        const pre = h('pre', { class: 'hl', 'aria-hidden': 'true' });
        const ta = h('textarea', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', placeholder: 'Type or paste code', 'aria-label': 'Code' });
        ta.value = b.source || '';
        const paint = () => { pre.innerHTML = R.highlight(ta.value, b.lang) + '\n '; };
        ta.addEventListener('input', () => { b.source = ta.value; paint(); dirty(); stats(); });
        ta.addEventListener('keydown', (e) => {
          const mod = e.ctrlKey || e.metaKey;
          if (e.key === 'Tab' && !mod && !e.altKey) { e.preventDefault(); indentSel(ta, e.shiftKey); return; }
          if (e.key === 'Enter' && !e.shiftKey && !mod && !e.altKey && ta.selectionStart === ta.selectionEnd) {
            const pos = ta.selectionStart, v = ta.value;
            const line = v.slice(v.lastIndexOf('\n', pos - 1) + 1, pos);
            const ind = line.match(/^\s*/)[0];
            const prev = v[pos - 1], next = v[pos];
            const extra = /[{(\[]$/.test(line.trimEnd()) || (/^(python|yaml)$/.test(b.lang) && /:$/.test(line.trimEnd())) ? '  ' : '';
            e.preventDefault();
            if (prev && next && '{[('.includes(prev) && '}])'.indexOf(next) === '{[('.indexOf(prev)) {
              typeInto(ta, '\n' + ind + '  \n' + ind);
              const np = pos + 1 + ind.length + 2;
              ta.setSelectionRange(np, np);
            } else typeInto(ta, '\n' + ind + extra);
          }
        });
        paint();
        return { node: h('div', { class: 'ed-stack' }, h('div', { class: 'ed-row' }, lang, fn), h('div', { class: 'codeedit' }, pre, ta)), focus: (o) => { ta.focus(); const n = o && o.start ? 0 : ta.value.length; ta.setSelectionRange(n, n); } };
      },
      image: (b, el) => mediaEditor(b, el, 'image'),
      video: (b, el) => mediaEditor(b, el, 'video'),
      audio: (b, el) => mediaEditor(b, el, 'audio'),
      callout(b) {
        const kind = h('select', { class: 'sel', 'aria-label': 'Callout type', onchange: () => { b.kind = kind.value; dirty(); } },
          [['note', 'Note'], ['tip', 'Tip'], ['warning', 'Warning'], ['danger', 'Important']].map(([k, l]) => h('option', { value: k, selected: (b.kind || 'note') === k }, l)));
        const title = field({ placeholder: 'Title (optional)', value: b.title || '', 'aria-label': 'Title', oninput: () => { b.title = title.value; dirty(); } });
        const ta = textArea(b, 'source', 'Callout text. Markdown works here too.');
        return { node: h('div', { class: 'ed-stack' }, h('div', { class: 'ed-row' }, kind, title), ta), focus: (o) => focusEnd(ta, o) };
      },
      todo(b) {
        const ta = h('textarea', { class: 'ta', rows: '3', spellcheck: 'true', placeholder: '- [ ] First task\n- [x] A finished task' });
        ta.value = (b.items || []).map((i) => (i.done ? '- [x] ' : '- [ ] ') + i.text).join('\n');
        ta.addEventListener('input', () => {
          b.items = ta.value.split('\n').filter((l) => l.trim()).map((l) => { const m = l.match(/^\s*(?:[-*]\s*)?(?:\[([ xX])\]\s*)?(.*)$/); return { done: m[1] === 'x' || m[1] === 'X', text: m[2] }; });
          fit(ta); dirty(); stats();
        });
        mdKeys(ta, false);
        requestAnimationFrame(() => fit(ta));
        return { node: ta, focus: (o) => focusEnd(ta, o) };
      },
      table(b) {
        b.rows = b.rows && b.rows.length ? b.rows : [['', ''], ['', '']];
        let last = { r: 0, c: 0 };
        const wrap = h('div', { class: 'tbl-edit' });
        const cols = () => Math.max(1, ...b.rows.map((r) => r.length));
        const norm = () => { const n = cols(); b.rows.forEach((r) => { for (let k = 0; k < n; k++) if (r[k] == null) r[k] = ''; }); };
        const focusCell = (r, c) => { const i = wrap.querySelector('[data-r="' + r + '"][data-c="' + c + '"]'); if (i) i.focus(); };
        function draw(focus) {
          norm();
          const t = h('table', { class: 'grid' });
          b.rows.forEach((row, r) => t.append(h('tr', {}, row.map((val, c) => {
            const i = h('input', { value: val, class: r === 0 && b.header !== false ? 'hd' : '', 'data-r': r, 'data-c': c, 'aria-label': 'Row ' + (r + 1) + ', column ' + (c + 1) });
            i.addEventListener('input', () => { b.rows[r][c] = i.value; dirty(); stats(); });
            i.addEventListener('focus', () => { last = { r, c }; });
            i.addEventListener('keydown', (e) => {
              if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
              e.preventDefault();
              if (r === b.rows.length - 1) { b.rows.push(Array(cols()).fill('')); dirty(); draw({ r: r + 1, c }); } else focusCell(r + 1, c);
            });
            i.addEventListener('paste', (e) => {
              const tx = (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '').replace(/\n$/, '');
              if (!/[\t\n]/.test(tx)) return;
              e.preventDefault();
              tx.split('\n').forEach((line, dr) => { while (b.rows.length <= r + dr) b.rows.push([]); line.split('\t').forEach((v, dc) => { b.rows[r + dr][c + dc] = v; }); });
              dirty(); draw({ r, c });
            });
            return h('td', {}, i);
          }))));
          const btn = (label, fn) => h('button', { class: 'btn', onclick: fn }, label);
          const hdr = h('input', { type: 'checkbox', checked: b.header !== false, onchange: () => { b.header = hdr.checked; dirty(); draw(last); } });
          wrap.replaceChildren(t, h('div', { class: 'tbl-tools' },
            btn('+ Row', () => { b.rows.splice(last.r + 1, 0, Array(cols()).fill('')); dirty(); draw({ r: last.r + 1, c: last.c }); }),
            btn('+ Column', () => { b.rows.forEach((r) => r.splice(last.c + 1, 0, '')); dirty(); draw({ r: last.r, c: last.c + 1 }); }),
            btn('− Row', () => { if (b.rows.length > 1) { b.rows.splice(last.r, 1); dirty(); draw({ r: Math.min(last.r, b.rows.length - 1), c: last.c }); } }),
            btn('− Column', () => { if (cols() > 1) { b.rows.forEach((r) => r.splice(last.c, 1)); dirty(); draw({ r: last.r, c: Math.min(last.c, cols() - 1) }); } }),
            h('label', {}, hdr, 'Header row')));
          if (focus) focusCell(focus.r, focus.c);
        }
        draw();
        return { node: wrap, focus: () => focusCell(0, 0) };
      },
      html(b, el) {
        const refresh = debounce(() => renderView(el, b), 300);
        const ta = h('textarea', { class: 'ta', spellcheck: 'false', rows: '6', placeholder: '<div>Any HTML. Scripts do not run.</div>', 'aria-label': 'HTML source' });
        ta.value = b.source || '';
        ta.addEventListener('input', () => { b.source = ta.value; fit(ta); dirty(); refresh(); });
        ta.addEventListener('keydown', (e) => { if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); indentSel(ta, e.shiftKey); } });
        const height = field({ type: 'number', min: '40', max: '2000', value: String(b.height || 240), style: 'width:90px', 'aria-label': 'Frame height',
          oninput: () => { b.height = +height.value || 240; dirty(); refresh(); } });
        requestAnimationFrame(() => fit(ta));
        return { node: h('div', { class: 'ed-stack' }, ta, h('div', { class: 'ed-row' }, h('label', { class: 'inline' }, 'Frame height (px)', height))), focus: (o) => focusEnd(ta, o) };
      },
      embed(b, el) {
        const refresh = debounce(() => renderView(el, b), 300);
        const url = field({ class: 'input grow', placeholder: 'https://… or a file in this folder (.html, .pdf)', value: b.url || '', 'aria-label': 'URL',
          oninput: () => { b.url = url.value.trim(); dirty(); refresh(); } });
        const height = field({ type: 'number', min: '80', max: '2000', value: String(b.height || 420), style: 'width:90px', 'aria-label': 'Frame height',
          oninput: () => { b.height = +height.value || 420; dirty(); refresh(); } });
        const browse = h('button', { class: 'btn', onclick: async () => { const p = await pickFile('embed'); if (p) { b.url = p; url.value = p; dirty(); renderView(el, b); } } }, 'Browse folder…');
        return { node: h('div', { class: 'ed-stack' }, h('div', { class: 'ed-row' }, url, browse), h('div', { class: 'ed-row' }, h('label', { class: 'inline' }, 'Frame height (px)', height))), focus: () => url.focus() };
      },
    };

    /* ---- outline ---- */
    function refreshOutline() {
      if (!prefs.outline) return;
      const hs = R.collectHeadings(nb.blocks);
      outlineEl.replaceChildren(h('div', { class: 'outline-title' }, 'Outline'),
        ...(hs.length ? hs.map((x) => h('a', { class: 'l' + x.level, href: '#' + x.id, title: x.text, onclick: (ev) => {
          ev.preventDefault(); select(x.blockId);
          const t = document.getElementById(x.id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } }, x.text || '(untitled)')) : [h('p', { class: 'muted pad' }, 'Headings from your Markdown blocks appear here.')]));
    }
    function toggleOutline() {
      prefs.outline = !prefs.outline; lsSet('jot.outline', prefs.outline ? '1' : '0');
      outlineEl.hidden = !prefs.outline; refreshOutline();
    }
    function setWidth(w) { prefs.width = w; lsSet('jot.width', w); page.dataset.width = w; }
    function setFont(f) { document.documentElement.dataset.font = f; lsSet('jot.font', f); }

    /* ---- file actions ---- */
    async function renameNb() {
      await save();
      const n = await promptText('Rename notebook', base, 'Rename');
      if (!n || n === base) return;
      try { const r = await api('/api/rename', { json: { path, name: n } }); location.replace('/edit/' + enc(r.path)); } catch (e) { toast(e.message, 'error'); }
    }
    async function exportAs(fmt) {
      exitEdit();
      await save();
      if (fmt === 'html') { location.href = '/api/export?format=html&path=' + encodeURIComponent(path); return; }
      try { const r = await api('/api/export?format=md&path=' + encodeURIComponent(path)); toast('Saved ' + basename(r.path) + ' next to this notebook'); } catch (e) { toast(e.message, 'error'); }
    }
    function printDoc() { exitEdit(); setTimeout(() => window.print(), 60); }

    /* ---- commands, menus, palette ---- */
    const C = {};
    const cmd = (id, label, run, o) => { C[id] = Object.assign({ id, label, run }, o); };
    cmd('save', 'Save notebook', () => save(true), { keys: 'Ctrl+S', icon: 'save' });
    cmd('rename', 'Rename notebook…', renameNb, { icon: 'edit' });
    cmd('export-html', 'Export as HTML (self-contained)', () => exportAs('html'), { icon: 'download' });
    cmd('export-md', 'Export as Markdown (saved next to notebook)', () => exportAs('md'), { icon: 'download' });
    cmd('print', 'Print or save as PDF…', printDoc, { icon: 'printer' });
    cmd('files', 'Open file browser', () => window.open('/tree/' + enc(dir), '_blank'), { icon: 'folder' });
    cmd('undo', 'Undo', undo, { keys: 'Z', icon: 'undo' });
    cmd('redo', 'Redo', redo, { keys: 'Shift+Z', icon: 'redo' });
    cmd('cut', 'Cut block', cutBlock, { keys: 'X', icon: 'cut' });
    cmd('copy', 'Copy block', copyBlock, { keys: 'C', icon: 'copy' });
    cmd('paste', 'Paste block below', () => pasteBlock(false), { keys: 'V', icon: 'paste' });
    cmd('paste-above', 'Paste block above', () => pasteBlock(true), { keys: 'Shift+V' });
    cmd('duplicate', 'Duplicate block', duplicateBlock);
    cmd('delete', 'Delete block', deleteBlock, { keys: 'D D', icon: 'trash' });
    cmd('up', 'Move block up', () => moveBlock(-1), { keys: 'Alt+↑', icon: 'up' });
    cmd('down', 'Move block down', () => moveBlock(1), { keys: 'Alt+↓', icon: 'down' });
    cmd('split', 'Split block at cursor', splitBlock, { keys: 'Alt+-' });
    cmd('merge', 'Merge with block below', mergeBelow);
    cmd('insert-above', 'Insert text block above', () => insertBlock('markdown', 'above'), { keys: 'A' });
    cmd('insert-below', 'Insert text block below', () => insertBlock('markdown', 'below'), { keys: 'B' });
    Object.keys(TYPES).forEach((t) => {
      cmd('add-' + t, 'Insert ' + TYPES[t].label + ' block below', () => insertBlock(t, 'below'), { icon: TYPES[t].icon, menuLabel: TYPES[t].label });
      cmd('to-' + t, 'Change block to ' + TYPES[t].label, () => convertType(t), { icon: TYPES[t].icon, menuLabel: TYPES[t].label, keys: t === 'markdown' ? 'M' : t === 'code' ? 'Y' : '' });
    });
    cmd('outline', 'Show or hide outline', toggleOutline, { keys: 'O', icon: 'outline' });
    [['narrow', 'Narrow'], ['normal', 'Standard'], ['wide', 'Wide'], ['full', 'Full width']].forEach(([w, l]) => cmd('width-' + w, 'Page width: ' + l, () => setWidth(w), { menuLabel: l }));
    cmd('font-sans', 'Document font: Sans-serif', () => setFont('sans'), { menuLabel: 'Sans-serif' });
    cmd('font-serif', 'Document font: Serif', () => setFont('serif'), { menuLabel: 'Serif' });
    cmd('theme', 'Toggle dark mode', toggleTheme, { icon: 'moon' });
    cmd('palette', 'Command palette…', () => palette(), { keys: 'Ctrl+K', icon: 'command' });
    cmd('help', 'Keyboard shortcuts', () => help(), { keys: 'H' });

    const MENUS = {
      File: ['save', 'rename', '-', 'export-html', 'export-md', 'print', '-', 'files'],
      Edit: ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'paste-above', '-', 'duplicate', 'delete', '-', 'up', 'down', '-', 'split', 'merge'],
      View: ['outline', '-', 'width-narrow', 'width-normal', 'width-wide', 'width-full', '-', 'font-sans', 'font-serif', '-', 'theme'],
      Insert: ['insert-above', 'insert-below', '-'].concat(Object.keys(TYPES).map((t) => 'add-' + t)),
      Block: Object.keys(TYPES).map((t) => 'to-' + t),
      Help: ['palette', 'help'],
    };
    const menuItems = (name) => MENUS[name].map((id) => (id === '-' ? { sep: true } :
      { label: C[id].menuLabel || C[id].label, icon: C[id].icon, shortcut: C[id].keys, onClick: C[id].run }));

    async function palette() {
      const input = h('input', { class: 'input pal-input', placeholder: 'Type a command…', 'aria-label': 'Command' });
      const list = h('div', { class: 'pal-list' });
      const all = Object.values(C).filter((c) => c.id !== 'palette');
      let shown = [], at = 0, close = () => {};
      const draw = () => {
        const q = input.value.toLowerCase().trim();
        shown = all.filter((c) => !q || c.label.toLowerCase().includes(q)).slice(0, 50);
        at = Math.max(0, Math.min(at, shown.length - 1));
        list.replaceChildren(...shown.map((c, i) => h('button', { class: 'pal-item' + (i === at ? ' on' : ''), onclick: () => close(c) }, h('span', {}, c.label), c.keys ? h('kbd', {}, c.keys) : null)));
        const on = list.children[at]; if (on) on.scrollIntoView({ block: 'nearest' });
      };
      input.addEventListener('input', () => { at = 0; draw(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(at + 1, shown.length - 1); draw(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(at - 1, 0); draw(); }
        else if (e.key === 'Enter') { e.preventDefault(); close(shown[at]); }
      });
      const c = await modal({ title: 'Command palette', body: (cl) => { close = cl; draw(); return h('div', {}, input, list); }, actions: [] });
      if (c) setTimeout(() => c.run(), 0);
    }
    function help() {
      const rows = [
        ['Command mode (press Esc)', null],
        ['Select previous / next block', '↑ ↓  or  K J'], ['Edit the selected block', 'Enter'], ['Finish and go to next block', 'Shift+Enter'],
        ['Insert block above / below', 'A  /  B'], ['Delete block', 'D D'], ['Copy, cut, paste block', 'C  X  V'],
        ['Undo / redo', 'Z  /  Shift+Z'], ['Change to Markdown / code', 'M  /  Y'], ['Heading level 1–6 (Markdown)', '1 … 6'],
        ['Move block up / down', 'Alt+↑  /  Alt+↓'], ['Show or hide outline', 'O'], ['Command palette', 'Ctrl+K  or  P'],
        ['Edit mode (press Enter)', null],
        ['Back to command mode', 'Esc  or  Ctrl+Enter'], ['Finish and select next block', 'Shift+Enter'],
        ['Bold / italic', 'Ctrl+B  /  Ctrl+I'], ['Indent / outdent', 'Tab  /  Shift+Tab'], ['Split block at cursor', 'Alt+-'],
        ['Everywhere', null],
        ['Save', 'Ctrl+S'],
      ];
      return modal({ title: 'Keyboard shortcuts', wide: true, body: h('div', { class: 'help-grid' }, rows.map(([a, k]) => (k === null ? h('h4', {}, a) : [h('span', {}, a), h('kbd', {}, k)]))), actions: [{ label: 'Close', value: null, primary: true }] });
    }

    /* ---- keyboard ---- */
    document.addEventListener('keydown', (e) => {
      if ($('.overlay')) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (mod && !e.shiftKey && !e.altKey && key === 's') { e.preventDefault(); save(true); return; }
      if (mod && !e.altKey && key === 'k') { e.preventDefault(); palette(); return; }
      const t = e.target;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
      if (typing) {
        if (!S.editing || !t.closest('.cell')) return;
        if (e.key === 'Escape') { e.preventDefault(); exitEdit(); return; }
        if (e.key === 'Enter' && (e.shiftKey || mod)) { e.preventDefault(); exitEdit(); if (e.shiftKey) selectNext(true); return; }
        if (e.altKey && !mod && e.key === 'ArrowUp') { e.preventDefault(); moveBlock(-1); return; }
        if (e.altKey && !mod && e.key === 'ArrowDown') { e.preventDefault(); moveBlock(1); return; }
        if (e.altKey && !mod && e.key === '-') { e.preventDefault(); splitBlock(); }
        return;
      }
      if (e.altKey && !mod) {
        if (e.key === 'ArrowUp') { e.preventDefault(); moveBlock(-1); } else if (e.key === 'ArrowDown') { e.preventDefault(); moveBlock(1); }
        return;
      }
      if (mod) {
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
        return;
      }
      if (t.closest && t.closest('.menu, .toolbar select, .modal')) return;
      let handled = true;
      switch (key) {
        case 'ArrowUp': case 'k': selectRel(-1); break;
        case 'ArrowDown': case 'j': selectRel(1); break;
        case 'Enter': if (e.shiftKey) selectNext(true); else enterEdit(S.sel); break;
        case 'a': insertBlock('markdown', 'above'); break;
        case 'b': insertBlock('markdown', 'below'); break;
        case 'd': { const now = Date.now(); if (now - S.lastD < 700) { S.lastD = 0; deleteBlock(); } else S.lastD = now; break; }
        case 'c': copyBlock(); break;
        case 'x': cutBlock(); break;
        case 'v': pasteBlock(e.shiftKey); break;
        case 'z': if (e.shiftKey) redo(); else undo(); break;
        case 'm': convertType('markdown'); break;
        case 'y': convertType('code'); break;
        case 'o': toggleOutline(); break;
        case 'p': palette(); break;
        case 'h': help(); break;
        case '0': case '1': case '2': case '3': case '4': case '5': case '6': setHeading(+key); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });

    doc.addEventListener('mousedown', (e) => {
      const c = e.target.closest('.cell');
      if (!c) return;
      if (S.editing && S.editing !== c.dataset.id) exitEdit();
      select(c.dataset.id);
    });
    page.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); page.classList.add('dragging'); } });
    page.addEventListener('dragleave', (e) => { if (!e.relatedTarget) page.classList.remove('dragging'); });
    page.addEventListener('drop', (e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); page.classList.remove('dragging'); addFiles(Array.from(e.dataTransfer.files)); });
    window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    setInterval(() => save(), 15000);
    setInterval(status, 30000);

    /* ---- build the page ---- */
    const tbtn = (ic, title, fn) => h('button', { class: 'tbtn', title, 'aria-label': title, onclick: fn, html: icon(ic) });
    const menubar = h('div', { class: 'menubar', role: 'menubar' }, Object.keys(MENUS).map((name) => {
      const b = h('button', { role: 'menuitem', onclick: () => showMenu(b, menuItems(name)), onmouseenter: () => { if (openMenu && openMenu.anchor !== b) showMenu(b, menuItems(name)); } }, name);
      return b;
    }));
    const addBtn = tbtn('plus', 'Insert block below', () => showMenu(addBtn, typeItems((t) => insertBlock(t, 'below'))));
    root.replaceChildren(
      h('div', { class: 'chrome' },
        h('div', { class: 'topbar' },
          h('a', { class: 'brand', href: '/tree/' + enc(dir), title: 'Back to files' }, logo(), 'Jotter'),
          h('button', { class: 'nbname', title: 'Rename notebook', onclick: renameNb }, base, h('span', { class: 'ext' }, '.jot')),
          saveState, h('span', { class: 'spacer' }), themeBtn()),
        menubar,
        h('div', { class: 'toolbar', role: 'toolbar' },
          tbtn('save', 'Save (Ctrl+S)', () => save(true)), h('span', { class: 'tsep' }),
          addBtn, tbtn('cut', 'Cut block', cutBlock), tbtn('copy', 'Copy block', copyBlock), tbtn('paste', 'Paste block below', () => pasteBlock(false)), h('span', { class: 'tsep' }),
          tbtn('up', 'Move block up', () => moveBlock(-1)), tbtn('down', 'Move block down', () => moveBlock(1)), h('span', { class: 'tsep' }),
          tbtn('undo', 'Undo', undo), tbtn('redo', 'Redo', redo), h('span', { class: 'tsep' }),
          typeSel, h('span', { class: 'spacer' }),
          tbtn('outline', 'Show or hide outline', toggleOutline), tbtn('command', 'Command palette (Ctrl+K)', () => palette()))),
      h('div', { class: 'workspace' }, outlineEl, page),
      h('div', { class: 'statusbar' }, modeEl, countEl, h('span', { class: 'spacer' }), saveEl2));
    renderAll();
    const first = cellEl(S.sel); if (first) first.focus({ preventScroll: true });
  }

  /* ================================================================ boot */
  async function boot() {
    applyPrefs();
    try { INFO = await api('/api/info'); } catch (e) {
      document.body.textContent = e.message;
      return;
    }
    let p = location.pathname;
    try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
    if (p.startsWith('/edit/')) await Editor(p.slice(6));
    else await Dashboard(p.replace(/^\/tree\/?/, '').replace(/\/+$/, ''));
  }
  boot();
})();
