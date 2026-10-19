# Jotter

A Jupyter-style notebook for writing documents and notes. Same feel as Jupyter (file browser, cells, command/edit modes), but no kernels and no code execution. Zero dependencies; needs Node 18+.

## Install and run

    cd jotter
    npm link            # once; gives you the `jotter` command everywhere
    cd ~/any/folder
    jotter              # serves the current folder and opens your browser

Without linking: `node /path/to/jotter/bin/jotter.js` from the folder you want to serve.
Options: `jotter [folder] [-p 8888] [--no-browser] [--no-token] [--host 127.0.0.1]`

The terminal prints a link with an access token (like Jupyter). Only that link can read or edit your files.

## Blocks

Markdown, Code (highlighted, never run), Image, Video (file, YouTube, Vimeo), Audio, Callout, To-do list, Table, HTML (sandboxed, no scripts), Embed (web page or PDF), Contents (auto table of contents), Divider.

Uploaded or pasted media is stored in `<notebook>_assets/` next to the notebook and follows it on rename, duplicate and delete.

## Keys

Esc = command mode, Enter = edit. A/B insert above/below, DD delete, C/X/V copy/cut/paste, Z undo, M/Y Markdown/code, 1-6 heading level, Shift+Enter next block, Alt+Up/Down move, Ctrl+S save, Ctrl+K command palette, H all shortcuts.

## Files and export

- Notebooks are plain JSON `.jot` files. Autosave every 15 seconds.
- Export: self-contained HTML (images inlined), Markdown (saved beside the notebook), or Print / Save as PDF.
- Deleting moves items to a hidden `.jotter-trash/` folder in the served directory.
