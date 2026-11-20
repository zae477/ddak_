import { cp, mkdir, readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const components = ['app.jsx', 'screens.jsx', 'restaurants.jsx', 'result.jsx', 'main.jsx'];
const source = await Promise.all(components.map(file => readFile(file, 'utf8')));
await mkdir('dist', { recursive: true });

await Promise.all([
  build({
    stdin: {
      contents: ["import React from 'react';", "import * as ReactDOM from 'react-dom/client';", ...source].join('\n'),
      resolveDir: process.cwd(),
      loader: 'jsx',
    },
    outfile: 'dist/app.js',
    bundle: true,
    minify: true,
    target: 'es2020',
    define: { 'process.env.NODE_ENV': '"production"' },
  }),
  ...['index.html', 'service-info.html', 'analytics.js', 'sharing.js', 'subwayGraph_browser.js', 'share-card.png', 'assets']
    .map(file => cp(file, 'dist/' + file, { recursive: true })),
]);
