/* Jotter: rendering shared by the browser editor and the Node exporter. No dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JotRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ utils */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ESC[c]);
  const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const isAbs = (u) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(u);

  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^(?:javascript|vbscript|file):/i.test(u)) return '#';
    if (/^data:/i.test(u) && !/^data:image\//i.test(u)) return '#';
    return u;
  }

  function encPath(p) {
    return String(p).split('/').map((s) => {
      try { return encodeURIComponent(decodeURIComponent(s)); } catch (e) { return encodeURIComponent(s); }
    }).join('/');
  }

  function embedUrl(u) {
    u = String(u || '').trim();
    let m = u.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)([\w-]{6,})/i) ||
            u.match(/^https?:\/\/youtu\.be\/([\w-]{6,})/i);
    if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    m = u.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/i);
    if (m) return 'https://player.vimeo.com/video/' + m[1];
    return '';
  }

  const slugify = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
  const plain = (s) => String(s).replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_~=]/g, '').trim();

  /* ------------------------------------------------------ rich text sanitising */
  const ENT = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
    mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00b7', bull: '\u2022',
    lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d', laquo: '\u00ab', raquo: '\u00bb',
    copy: '\u00a9', reg: '\u00ae', trade: '\u2122', deg: '\u00b0', plusmn: '\u00b1',
    frac12: '\u00bd', frac14: '\u00bc', frac34: '\u00be', sup2: '\u00b2', sup3: '\u00b3', micro: '\u00b5',
    times: '\u00d7', divide: '\u00f7', euro: '\u20ac', pound: '\u00a3', yen: '\u00a5', cent: '\u00a2',
    sect: '\u00a7', para: '\u00b6', dagger: '\u2020', Dagger: '\u2021', permil: '\u2030',
  };
  function decodeEntities(s) {
    return String(s).replace(/&(#x[\da-f]+|#\d+|[a-z][a-z0-9]+);/gi, (m, e) => {
      if (e.charAt(0) === '#') {
        const n = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
      }
      const v = ENT[e] !== undefined ? ENT[e] : ENT[e.toLowerCase()];
      return v === undefined ? m : v;
    });
  }
  const stripTags = (s) => decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

  const RT_TAGS = new Set(['p', 'div', 'br', 'strong', 'em', 'u', 's', 'del', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img', 'hr', 'span', 'mark', 'sub', 'sup']);
  const RT_VOID = new Set(['br', 'img', 'hr']);
  const RT_DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template',
    'noscript', 'link', 'meta', 'base', 'form', 'input', 'button', 'select', 'textarea', 'video', 'audio', 'source', 'canvas']);
  const RT_ATTRS = { a: ['href', 'title'], img: ['src', 'alt', 'title', 'data-rel'] };
  const RT_TAG = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

  function rtAttrs(name, raw, urlOf) {
    const allowed = RT_ATTRS[name];
    if (!allowed) return '';
    const out = [];
    const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let m;
    while ((m = re.exec(raw || ''))) {
      const key = m[1].toLowerCase();
      if (!allowed.includes(key)) continue;
      const value = decodeEntities(m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] || '');
      if (key === 'href' || key === 'src') {
        if (!value.trim()) continue;
        const u = urlOf(value);
        if (u === '#' && value.trim().charAt(0) !== '#') continue;
        out.push(key + '="' + esc(u) + '"');
      } else out.push(key + '="' + esc(value) + '"');
    }
    if (name === 'a' && out.some((a) => a.startsWith('href='))) out.push('target="_blank"', 'rel="noopener noreferrer"');
    if (name === 'img') {
      if (!out.some((a) => a.startsWith('src='))) return '';
      out.push('loading="lazy"');
    }
    return out.length ? ' ' + out.join(' ') : '';
  }

  function sanitizeHtml(html, resolve) {
    const src = String(html == null ? '' : html);
    const out = [];
    const stack = [];
    const urlOf = (v) => {
      const u = safeUrl(v);
      return resolve ? resolve(u) : u;
    };
    let skip = null, skipDepth = 0, last = 0, m;
    RT_TAG.lastIndex = 0;
    const text = (t) => { if (!skip && t) out.push(esc(decodeEntities(t))); };
    while ((m = RT_TAG.exec(src))) {
      text(src.slice(last, m.index));
      last = RT_TAG.lastIndex;
      if (!m[1]) continue;
      let name = m[1].toLowerCase();
      const closing = m[0].charAt(1) === '/';
      const self = /\/\s*>$/.test(m[0]);
      if (skip) {
        if (name === skip) {
          if (closing) { if (--skipDepth === 0) skip = null; }
          else if (!self) skipDepth++;
        }
        continue;
      }
      if (RT_DROP.has(name)) {
        if (!closing && !self) { skip = name; skipDepth = 1; }
        continue;
      }
      if (/^h[1-6]$/.test(name)) name = 'p';
      else if (name === 'b') name = 'strong';
      else if (name === 'i') name = 'em';
      else if (name === 'strike') name = 's';
      if (!RT_TAGS.has(name)) continue;
      if (closing) {
        const at = stack.lastIndexOf(name);
        if (at >= 0) while (stack.length > at) out.push('</' + stack.pop() + '>');
        continue;
      }
      const attrs = rtAttrs(name, m[2], urlOf);
      if (name === 'img') {
        if (attrs) out.push('<img' + attrs + '>');
        continue;
      }
      if (RT_VOID.has(name)) { out.push('<' + name + attrs + '>'); continue; }
      if (self) { out.push('<' + name + attrs + '></' + name + '>'); continue; }
      out.push('<' + name + attrs + '>');
      stack.push(name);
    }
    text(src.slice(last));
    while (stack.length) out.push('</' + stack.pop() + '>');
    return out.join('');
  }

  function sanitizeSvg(svg) {
    return String(svg || '')
      .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<script\b[^>]*\/?>/gi, '')
      .replace(/([\s/])on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1')
      .replace(/((?:xlink:)?href\s*=\s*)(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '$1"#"');
  }

  /* ------------------------------------------------------ syntax highlighting */
  const kw = (s) => '\\b(?:' + s.trim().split(/\s+/).join('|') + ')\\b';
  const RX = {
    cline: /\/\/[^\n]*/.source,
    cblock: /\/\*[\s\S]*?\*\//.source,
    hash: /#[^\n]*/.source,
    dash: /--[^\n]*/.source,
    dq: /"(?:\\.|[^"\\\n])*"/.source,
    sq: /'(?:\\.|[^'\\\n])*'/.source,
    bt: /`(?:\\[\s\S]|[^`\\])*`/.source,
    tq: /"""[\s\S]*?"""|'''[\s\S]*?'''/.source,
    num: /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/.source,
    call: /\b[A-Za-z_$][\w$]*(?=\()/.source,
  };
  const KW = {
    js: 'as async await break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield interface type enum implements public private protected readonly abstract namespace declare',
    py: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case self',
    c: 'auto break case char class const continue default do double else enum extern float for goto if inline int long namespace new operator private protected public register return short signed sizeof static struct switch template this throw try typedef union unsigned using virtual void volatile while fn let mut pub impl trait use mod loop func go defer chan select package import interface map range var type string bool byte final abstract extends implements throws synchronized boolean foreach function echo fun val when object override open data sealed suspend',
    sh: 'if then else elif fi for while do done case esac function in return export local echo cd ls sudo exit set unset source alias read shift test',
    sql: 'select from where and or not insert into values update set delete create table alter drop index join left right inner outer on group by order having limit offset as distinct union all null is in like between exists primary key foreign references default unique case when then else end',
  };
  const FAMILY = {
    js: [['com', RX.cline + '|' + RX.cblock], ['str', RX.bt + '|' + RX.dq + '|' + RX.sq], ['num', RX.num], ['lit', kw('true false null undefined NaN Infinity')], ['kw', kw(KW.js)], ['fn', RX.call]],
    py: [['com', RX.hash], ['str', RX.tq + '|' + RX.dq + '|' + RX.sq], ['num', RX.num], ['lit', kw('True False None')], ['kw', kw(KW.py)], ['fn', RX.call]],
    c: [['com', RX.cline + '|' + RX.cblock], ['str', RX.dq + '|' + RX.sq], ['num', RX.num], ['lit', kw('true false null nil NULL')], ['kw', kw(KW.c)], ['fn', RX.call]],
    sh: [['com', RX.hash], ['str', RX.dq + '|' + RX.sq], ['num', RX.num], ['kw', kw(KW.sh)], ['fn', /\$\{?[A-Za-z_]\w*\}?/.source]],
    sql: [['com', RX.dash + '|' + RX.cblock], ['str', RX.sq + '|' + RX.dq], ['num', RX.num], ['kw', kw(KW.sql)], ['fn', RX.call]],
    json: [['key', RX.dq + '(?=\\s*:)'], ['str', RX.dq], ['num', /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/.source], ['lit', kw('true false null')]],
    yaml: [['com', RX.hash], ['str', RX.dq + '|' + RX.sq], ['key', /[A-Za-z_][\w.\-]*(?=\s*:(?:\s|$))/.source], ['num', RX.num], ['lit', kw('true false null yes no')]],
    css: [['com', RX.cblock], ['str', RX.dq + '|' + RX.sq], ['key', /@[\w-]+|-{0,2}[A-Za-z][\w-]*(?=\s*:)/.source], ['num', /#[\da-fA-F]{3,8}\b|-?\b\d*\.?\d+(?:px|r?em|%|vh|vw|ms|s|deg|fr)?/.source]],
    html: [['com', /<!--[\s\S]*?-->/.source], ['kw', /<\/?[A-Za-z][\w:-]*|\/?>/.source], ['key', /[A-Za-z_:][\w:.-]*(?==)/.source], ['str', RX.dq + '|' + RX.sq]],
  };
  const ALIAS = {
    js: 'js', javascript: 'js', jsx: 'js', ts: 'js', typescript: 'js', tsx: 'js', node: 'js', mjs: 'js',
    py: 'py', python: 'py',
    c: 'c', cpp: 'c', 'c++': 'c', java: 'c', go: 'c', rust: 'c', rs: 'c', cs: 'c', csharp: 'c', php: 'c', kotlin: 'c', swift: 'c', dart: 'c',
    sh: 'sh', bash: 'sh', shell: 'sh', zsh: 'sh',
    sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml',
    css: 'css', scss: 'css', less: 'css',
    html: 'html', xml: 'html', svg: 'html', vue: 'html',
  };
  const LANGS = ['text', 'javascript', 'typescript', 'python', 'bash', 'json', 'html', 'css', 'sql', 'yaml', 'c', 'cpp', 'java', 'go', 'rust', 'php', 'csharp', 'kotlin', 'swift', 'markdown'];
  const reCache = {};

  function highlight(code, lang) {
    code = String(code == null ? '' : code);
    const fam = ALIAS[String(lang || '').toLowerCase()];
    if (!fam || code.length > 300000) return esc(code);
    const rules = FAMILY[fam];
    const re = reCache[fam] || (reCache[fam] = new RegExp(rules.map((r) => '(' + r[1] + ')').join('|'), fam === 'sql' ? 'gi' : 'g'));
    re.lastIndex = 0;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      let i = 1;
      while (m[i] === undefined) i++;
      out += esc(code.slice(last, m.index)) + '<span class="tk-' + rules[i - 1][0] + '">' + esc(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + esc(code.slice(last));
  }

  /* ---------------------------------------------------------------- markdown */
  const emph = (s) => s
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=[^\s*])([\s\S]*?[^\s*])\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=[^\s_])([\s\S]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/==(?=\S)([\s\S]*?\S)==/g, '<mark>$1</mark>');

  function inline(text, o) {
    o = o || {};
    const stash = [];
    const put = (html) => '\u0000' + (stash.push(html) - 1) + '\u0000';
    const href = (u) => esc(o.resolve ? o.resolve(safeUrl(unesc(u))) : safeUrl(unesc(u)));
    let s = String(text);
    s = s.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (m, a, code) => put('<code>' + esc(code.trim()) + '</code>'));
    s = s.replace(/\\([\\`*_{}\[\]()#+\-.!~|=<>])/g, (m, c) => put(esc(c)));
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g, (m, alt, u, t) =>
      put('<img src="' + href(u) + '" alt="' + alt + '"' + (t ? ' title="' + t + '"' : '') + ' loading="lazy">'));
    s = s.replace(/\[([^\]]+)\]\(\s*([^\s)]+)(?:\s+&quot;(.*?)&quot;)?\s*\)/g, (m, txt, u, t) =>
      put('<a href="' + href(u) + '"' + (t ? ' title="' + t + '"' : '') + (u.charAt(0) === '#' ? '' : ' target="_blank" rel="noopener noreferrer"') + '>' + emph(txt) + '</a>'));
    s = s.replace(/&lt;(https?:\/\/[^\s&]+?)&gt;/g, (m, u) => put('<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'));
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+?)(?=[.,;:!?)]*(?:\s|$|\u0000))/g, (m, pre, u) =>
      pre + put('<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'));
    s = s.replace(/( {2,}|\\)\n/g, '<br>\n');
    s = emph(s);
    for (let k = 0; k < 4 && /\u0000\d+\u0000/.test(s); k++) s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[+i]);
    return s;
  }

  const LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
  const FENCE = /^\s*(```+|~~~+)\s*([^\s`]*)[^`]*$/;
  const HEAD = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
  const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
  const TSEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
  const indentOf = (l) => l.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
  const nest = (o) => (o.nested ? o : Object.assign({}, o, { nested: true }));

  const splitRow = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  const tableAt = (lines, i) => i + 1 < lines.length && lines[i].includes('|') && TSEP.test(lines[i + 1]) &&
    lines[i + 1].includes('-') && splitRow(lines[i]).length === splitRow(lines[i + 1]).length;

  function startsBlock(lines, i) {
    const l = lines[i];
    return FENCE.test(l) || HEAD.test(l) || HR.test(l) || /^\s{0,3}>/.test(l) || LIST.test(l) ||
      tableAt(lines, i);
  }

  function codeBlock(code, lang) {
    return '<div class="codeblock"><pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' + highlight(code, lang) + '</code></pre></div>';
  }

  function tableHtml(head, rows, aligns, o) {
    const cell = (tag, c, i) => '<' + tag + (aligns && aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' + inline(c || '', o) + '</' + tag + '>';
    const n = Math.max(head ? head.length : 0, ...rows.map((r) => r.length));
    const cols = Array.from({ length: n }, (_, i) => i);
    return '<div class="tbl"><table>' +
      (head ? '<thead><tr>' + cols.map((i) => cell('th', head[i], i)).join('') + '</tr></thead>' : '') +
      '<tbody>' + rows.map((r) => '<tr>' + cols.map((i) => cell('td', r[i], i)).join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  function listHtml(lines, i, o) {
    const first = lines[i].match(LIST);
    const base = indentOf(first[1]);
    const ordered = /\d/.test(first[2]);
    const start = ordered ? parseInt(first[2], 10) : 1;
    const items = [];
    while (i < lines.length) {
      const m = lines[i].match(LIST);
      if (!m || indentOf(m[1]) !== base || /\d/.test(m[2]) !== ordered) break;
      const kids = [];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) {
          let j = i;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && indentOf(lines[j]) > base) { kids.push(''); i++; continue; }
          break;
        }
        if (indentOf(l) > base) { kids.push(l); i++; continue; }
        break;
      }
      items.push({ text: m[3], kids });
    }
    const tag = ordered ? 'ol' : 'ul';
    let html = '<' + tag + (ordered && start !== 1 ? ' start="' + start + '"' : '') + '>';
    for (const it of items) {
      let t = it.text, cls = '', pre = '';
      const tm = t.match(/^\[([ xX])\]\s+(.*)$/);
      if (tm) { cls = ' class="task"'; pre = '<input type="checkbox" disabled' + (tm[1] !== ' ' ? ' checked' : '') + '> '; t = tm[2]; }
      let kidHtml = '';
      if (it.kids.some((k) => k.trim())) {
        const min = Math.min(...it.kids.filter((k) => k.trim()).map(indentOf));
        kidHtml = blocks(it.kids.map((k) => k.replace(new RegExp('^[ \\t]{0,' + min + '}'), '')), nest(o));
      }
      html += '<li' + cls + '>' + pre + inline(t, o) + kidHtml + '</li>';
    }
    return { html: html + '</' + tag + '>', next: i };
  }

  function blocks(lines, o) {
    let out = '', i = 0, m;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if ((m = line.match(FENCE))) {
        const ch = m[1][0], len = m[1].length, lang = m[2], code = [];
        const close = new RegExp('^\\s*' + (ch === '`' ? '`' : '~') + '{' + len + ',}\\s*$');
        i++;
        while (i < lines.length && !close.test(lines[i])) code.push(lines[i++]);
        i++;
        out += codeBlock(code.join('\n'), lang);
        continue;
      }
      if ((m = line.match(HEAD))) {
        const n = m[1].length;
        const id = !o.nested && o.idPrefix ? ' id="' + o.idPrefix + '-' + (o.hn.n++) + '"' : '';
        out += '<h' + n + id + '>' + inline(m[2], o) + '</h' + n + '>';
        i++;
        continue;
      }
      if (HR.test(line)) { out += '<hr>'; i++; continue; }
      if (/^\s{0,3}>/.test(line)) {
        const q = [];
        while (i < lines.length && /^\s{0,3}>/.test(lines[i])) q.push(lines[i++].replace(/^\s{0,3}> ?/, ''));
        out += '<blockquote>' + blocks(q, nest(o)) + '</blockquote>';
        continue;
      }
      if (tableAt(lines, i)) {
        const split = splitRow;
        const head = split(line);
        const aligns = split(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:-/.test(c) ? 'left' : ''));
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(split(lines[i++]));
        out += tableHtml(head, rows, aligns, o);
        continue;
      }
      if (LIST.test(line)) {
        const r = listHtml(lines, i, o);
        out += r.html;
        i = r.next;
        continue;
      }
      const para = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) para.push(lines[i++]);
      out += '<p>' + inline(para.join('\n'), o) + '</p>';
    }
    return out;
  }

  function md(src, opts) {
    const o = Object.assign({}, opts, { hn: { n: 0 } });
    return blocks(String(src || '').replace(/\r\n?/g, '\n').split('\n'), o);
  }

  function collectHeadings(list) {
    const hs = [];
    for (const b of list) {
      if (b.type !== 'markdown') continue;
      let fence = null, n = 0;
      for (const line of String(b.source || '').replace(/\r\n?/g, '\n').split('\n')) {
        const f = line.match(/^\s*(```+|~~~+)/);
        if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; continue; }
        if (fence) continue;
        const m = line.match(HEAD);
        if (m) hs.push({ level: m[1].length, text: plain(m[2]), id: 'h-' + b.id + '-' + (n++), blockId: b.id });
      }
    }
    return hs;
  }

  /* ------------------------------------------------------------- block views */
  const CALLOUT = { note: 'Note', tip: 'Tip', warning: 'Warning', danger: 'Important' };

  function blockHtml(b, ctx) {
    ctx = ctx || {};
    const o = { resolve: ctx.resolve, idPrefix: 'h-' + b.id };
    const url = (u) => esc(ctx.resolve ? ctx.resolve(safeUrl(u)) : safeUrl(u));
    const cap = b.caption ? '<figcaption>' + inline(b.caption, o) + '</figcaption>' : '';
    const none = (t) => '<div class="empty-media">' + t + '</div>';
    switch (b.type) {
      case 'markdown':
        return '<div class="md">' + md(b.source, o) + '</div>';
      case 'richtext':
        return '<div class="md rt">' + sanitizeHtml(b.html || '', ctx.resolve) + '</div>';
      case 'mermaid': {
        const cached = sanitizeSvg(b.svg);
        if (cached && !ctx.live) return '<div class="mmd">' + cached + '</div>';
        if (ctx.live) return '<div class="mmd"><div class="mmd-status">Rendering diagram…</div></div>';
        return '<div class="mmd mmd-fallback"><pre><code class="language-mermaid">' + esc(b.source || '') + '</code></pre></div>';
      }
      case 'code': {
        const lang = b.lang && b.lang !== 'text' ? b.lang : '';
        const head = b.filename || lang ? '<div class="code-head"><span class="fname">' + esc(b.filename || '') + '</span><span class="lang">' + esc(lang) + '</span></div>' : '';
        return '<div class="codeblock">' + head + '<pre><code>' + highlight(b.source || '', lang) + '</code></pre></div>';
      }
      case 'image': {
        if (!b.src) return none('No image selected');
        const w = +b.width > 0 && +b.width < 100 ? ' style="width:' + Math.round(+b.width) + '%"' : '';
        const al = ['left', 'center', 'right'].includes(b.align) ? b.align : 'center';
        return '<figure class="img align-' + al + '"' + w + '><img src="' + url(b.src) + '" alt="' + esc(b.alt) + '" loading="lazy">' + cap + '</figure>';
      }
      case 'video': {
        if (!b.src) return none('No video selected');
        const emb = embedUrl(b.src);
        const inner = emb
          ? '<div class="ratio"><iframe src="' + esc(emb) + '" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>'
          : '<video controls preload="metadata" src="' + url(b.src) + '"></video>';
        return '<figure class="media">' + inner + cap + '</figure>';
      }
      case 'audio':
        if (!b.src) return none('No audio selected');
        return '<figure class="media"><audio controls preload="metadata" src="' + url(b.src) + '"></audio>' + cap + '</figure>';
      case 'callout': {
        const k = CALLOUT[b.kind] ? b.kind : 'note';
        return '<div class="callout ' + k + '"><div class="callout-title">' + esc(b.title || CALLOUT[k]) + '</div><div class="md">' + md(b.source, o) + '</div></div>';
      }
      case 'todo':
        return '<ul class="todo">' + (b.items || []).map((it, i) =>
          '<li class="' + (it.done ? 'done' : '') + '"><input type="checkbox" data-i="' + i + '"' + (it.done ? ' checked' : '') + (ctx.live ? '' : ' disabled') + '><span>' + inline(it.text || '', o) + '</span></li>').join('') + '</ul>';
      case 'table': {
        const rows = (b.rows && b.rows.length ? b.rows : [['']]).map((r) => r.map((c) => (c == null ? '' : String(c))));
        return b.header === false ? tableHtml(null, rows, null, o) : tableHtml(rows[0], rows.slice(1), null, o);
      }
      case 'html':
        return '<iframe class="htmlframe" sandbox srcdoc="' + esc(b.source || '') + '" style="height:' + (Math.max(40, Math.min(2000, +b.height || 240))) + 'px" title="HTML block"></iframe>';
      case 'embed': {
        if (!b.url) return none('Nothing embedded');
        const emb = embedUrl(b.url);
        const r = emb || (ctx.resolve ? ctx.resolve(safeUrl(b.url)) : safeUrl(b.url));
        const external = /^https?:/i.test(r);
        return '<iframe class="embedframe" src="' + esc(r) + '"' + (external ? ' sandbox="allow-scripts allow-same-origin allow-popups allow-forms"' : '') + ' loading="lazy" style="height:' + (Math.max(80, Math.min(2000, +b.height || 420))) + 'px" title="Embedded content"></iframe>';
      }
      case 'toc': {
        const hs = typeof ctx.headings === 'function' ? ctx.headings() : ctx.headings || [];
        if (!hs.length) return none('Contents appear here once your text blocks have headings');
        const min = Math.min(...hs.map((x) => x.level));
        return '<nav class="toc"><div class="toc-title">Contents</div>' + hs.map((x) => '<a class="lvl' + Math.min(5, x.level - min + 1) + '" href="#' + x.id + '">' + esc(x.text) + '</a>').join('') + '</nav>';
      }
      case 'divider':
        return '<hr>';
      default:
        return '';
    }
  }

  /* ----------------------------------------------------------------- exports */
  function wordCount(nb) {
    let text = '';
    for (const b of nb.blocks || []) {
      text += ' ' + [b.source, b.caption, b.title].filter(Boolean).join(' ');
      if (b.html) text += ' ' + stripTags(b.html);
      if (b.items) text += ' ' + b.items.map((i) => i.text).join(' ');
      if (b.rows) text += ' ' + b.rows.map((r) => r.join(' ')).join(' ');
    }
    const m = text.match(/[^\s]+/g);
    return m ? m.length : 0;
  }

  function toMarkdown(nb) {
    const heads = collectHeadings(nb.blocks);
    const mdUrl = (u) => (isAbs(u) ? u : encPath(u));
    const out = [];
    for (const b of nb.blocks) {
      switch (b.type) {
        case 'markdown': out.push(String(b.source || '').trim()); break;
        case 'richtext': {
          const html = sanitizeHtml(b.html || '').trim();
          if (html) out.push(html);
          break;
        }
        case 'mermaid': {
          const src = String(b.source || '').trim();
          if (src) {
            const f = src.includes('```') ? '~~~~' : '```';
            out.push(f + 'mermaid\n' + src + '\n' + f);
          }
          break;
        }
        case 'code': {
          const src = b.source || '';
          const f = src.includes('```') ? '~~~~' : '```';
          out.push((b.filename ? '**' + b.filename + '**\n\n' : '') + f + (b.lang && b.lang !== 'text' ? b.lang : '') + '\n' + src + '\n' + f);
          break;
        }
        case 'image':
          if (b.src) out.push('![' + (b.alt || '') + '](' + mdUrl(b.src) + ')' + (b.caption ? '\n\n*' + b.caption + '*' : ''));
          break;
        case 'video':
          if (b.src) out.push((embedUrl(b.src) || /^https?:/i.test(b.src) ? '[Watch video](' + b.src + ')' : '<video src="' + mdUrl(b.src) + '" controls></video>') + (b.caption ? '\n\n*' + b.caption + '*' : ''));
          break;
        case 'audio':
          if (b.src) out.push((/^https?:/i.test(b.src) ? '[Listen](' + b.src + ')' : '<audio src="' + mdUrl(b.src) + '" controls></audio>') + (b.caption ? '\n\n*' + b.caption + '*' : ''));
          break;
        case 'callout': {
          const t = { note: 'NOTE', tip: 'TIP', warning: 'WARNING', danger: 'CAUTION' }[b.kind] || 'NOTE';
          out.push('> [!' + t + ']\n' + String(b.source || '').trim().split('\n').map((l) => '> ' + l).join('\n'));
          break;
        }
        case 'todo': out.push((b.items || []).map((i) => '- [' + (i.done ? 'x' : ' ') + '] ' + i.text).join('\n')); break;
        case 'table': {
          const rows = (b.rows || []).map((r) => r.map((c) => String(c == null ? '' : c).replace(/\|/g, '\\|').replace(/\n/g, ' ')));
          if (!rows.length) break;
          const n = Math.max(...rows.map((r) => r.length));
          const pad = (r) => Array.from({ length: n }, (_, i) => r[i] || '');
          const head = b.header === false ? pad([]) : pad(rows[0]);
          const body = b.header === false ? rows : rows.slice(1);
          out.push(['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |'].concat(body.map((r) => '| ' + pad(r).join(' | ') + ' |')).join('\n'));
          break;
        }
        case 'html': out.push(String(b.source || '').trim()); break;
        case 'embed': if (b.url) out.push('[Embedded content](' + b.url + ')'); break;
        case 'toc': {
          if (!heads.length) break;
          const min = Math.min(...heads.map((x) => x.level));
          out.push(heads.map((x) => '  '.repeat(x.level - min) + '- [' + x.text + '](#' + slugify(x.text) + ')').join('\n'));
          break;
        }
        case 'divider': out.push('---'); break;
        default: break;
      }
    }
    return out.filter(Boolean).join('\n\n') + '\n';
  }

  function toHtmlDocument(nb, opts) {
    opts = opts || {};
    const ctx = { resolve: opts.resolve, headings: collectHeadings(nb.blocks) };
    const body = nb.blocks.map((b) => '<section class="blk blk-' + esc(b.type) + '">' + blockHtml(b, ctx) + '</section>').join('\n');
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(opts.title || 'Notebook') + '</title><style>' + (opts.css || '') + '</style></head>' +
      '<body class="export"><main class="doc">' + body + '</main></body></html>\n';
  }

  return { esc, md, inline, highlight, blockHtml, collectHeadings, toMarkdown, toHtmlDocument, wordCount, embedUrl, encPath, LANGS, sanitizeHtml, sanitizeSvg, stripTags };
});
