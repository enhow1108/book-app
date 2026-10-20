// Serves dist/ the way GitHub Pages does: under /book-app, with 404.html for paths that aren't files.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  if (!path.startsWith('/book-app')) {
    res.writeHead(302, { location: '/book-app/' }).end();
    return;
  }
  let file = normalize(path.slice('/book-app'.length) || '/');
  if (file.endsWith('/')) file += 'index.html';
  try {
    const body = await readFile(join(root, file));
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': types['.html'] }).end(await readFile(join(root, '404.html')));
  }
}).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}/book-app/`));
