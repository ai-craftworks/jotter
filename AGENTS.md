# AGENTS.md

Jotter is a zero-dependency Node 18+ app. There is no build, bundler, test suite, lint, or typecheck. `public/` is served verbatim; server code is plain CommonJS.

## Run and verify

```sh
node bin/jotter.js <folder> -p 8888 --no-browser --no-token
```

Serve a scratch folder, not the repo root — the server exposes every file under its root. Open `http://127.0.0.1:8888/edit/<name>.jot`.

There is no test command. Minimum check after JS edits:

```sh
node --check bin/jotter.js
node --check src/server.js
node --check public/render.js
node --check public/app.js
```

Then smoke-test in a browser: create/open a notebook, edit blocks, Ctrl+S, reload, export HTML and Markdown. No `npm install` step is needed.

## Layout

- `bin/jotter.js` — CLI flags, starts the server, opens the browser.
- `src/server.js` — all HTTP handling in one `createHandler()` switch: pages, `/api/*`, `/files/*`, `/static/*`, auth. Exports `{ start, createHandler }`.
- `public/index.html` — loads `/static/render.js` then `/static/app.js`.
- `public/render.js` — UMD shared by the browser and the Node exporter. **Must stay DOM-free.** The server `require`s it, so browser-only changes break exports.
- `public/app.js` — entire browser UI/editor in one IIFE; depends on `window.JotRender`. Routes: `/tree/` dashboard, `/edit/<path>` editor.
- `public/doc.css` — document/export styles (also inlined into exported HTML); `public/style.css` — app chrome and editor UI only.
- `public/mermaid.min.js` — vendored Mermaid 12.3.0; do not edit. Upgrade only by replacing it and `mermaid.LICENSE` with the browser-global build (no ESM exports).

## Adding a block type

`TYPES` drives most menus, but these spots are manual:

1. `TYPES`, `HINT`, `DEFAULTS`, `isEmpty` in `public/app.js`.
2. `EDITORS` in `app.js` — factory `(block, cellEl) => { node, focus }`.
3. The hard-coded `.add-row` type array in `renderAll()`.
4. `blockHtml()` — plus `toMarkdown()` / `wordCount()` when relevant — in `render.js`.
5. Styles in `doc.css` (document view/export) and/or `style.css` (editing chrome).

The Insert/Block menus, command palette, conversion commands and inter-block "+" menu derive from `TYPES` automatically. `convertType()` only carries the `source` field, so conversions involving rich text or Mermaid are intentionally lossy.

## Invariants and gotchas

- `.jot` files are plain JSON with `format: 'jotter', version: 1`. The server's `normalize()` drops malformed blocks and re-IDs duplicates but preserves unknown fields; add a migration before changing the format.
- Uploaded/pasted media goes through `POST /api/upload` into `<notebook>_assets/`, stored as paths relative to the notebook. Rename/duplicate rewrite references and move/copy that folder (`moveAssets`); keep the `_assets` naming convention.
- Rich text stores sanitized HTML in `block.html`. The editor maps relative `<img>` paths to `/files/...` via `data-rel`; saved HTML must not contain `data-rel`. Sanitization lives in `render.js` and runs on both save and render.
- Mermaid blocks store `{ source, svg }`; `svg` is a cache for HTML export and print. In the editor, `blockHtml(..., { live: true })` returns a placeholder and `paintMermaid()` fills it. Undo snapshots deliberately omit `svg`.
- Exports are server-side: `GET /api/export?format=html|md&path=...`. HTML inlines local images and cached SVG; Markdown is written beside the notebook. `render.js` changes affect both the app and exports.
- CSP is strict (`script-src 'self'`, no eval/CDN). New browser assets must live in `public/` **and** be added to the `STATIC` set in `src/server.js`; Mermaid is lazy-loaded that way.
- Do not weaken server protections: `abs()` confines paths to the served root, mutating requests verify `Origin`, token auth uses an HttpOnly cookie, and exported HTML must stay sanitized.
- Autosave runs every 15 s; `PUT /api/nb` checks the `base` mtime and returns 409 after external edits. Reuse the existing save/undo helpers instead of adding another persistence path.

`README.md` is the only user-facing doc; update it when behavior or supported blocks change.
