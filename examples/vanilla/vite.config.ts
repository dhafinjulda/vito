/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob: https://cdn.jsdelivr.net https://storage.googleapis.com; font-src 'self' data:;",
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};
const developmentHeaders = {
  ...securityHeaders,
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob: ws://localhost:* ws://127.0.0.1:* https://cdn.jsdelivr.net https://storage.googleapis.com; font-src 'self' data:;",
};

function offlineWorker() {
  return {
    name: 'vto-offline-worker',
    apply: 'build' as const,
    async closeBundle() {
      const output = resolve(root, 'dist');
      const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8')) as Record<string, { file: string; css?: string[]; assets?: string[] }>;
      const shell = new Set<string>(['/', '/index.html', '/diagnostics.html', '/fit-check.html', '/favicon.svg', '/glasses.glb', '/glasses-alt.glb', '/round-spectacles.glb', '/vto-face-worker.js']);
      for (const entry of Object.values(manifest)) {
        shell.add(`/${entry.file}`);
        entry.css?.forEach((file) => shell.add(`/${file}`));
        entry.assets?.forEach((file) => shell.add(`/${file}`));
      }
      const urls = [...shell].sort();
      const contentHash = createHash('sha256');
      for (const url of urls) {
        const relative = url === '/' ? 'index.html' : url.slice(1);
        contentHash.update(url).update(await readFile(resolve(output, relative)));
      }
      const version = contentHash.digest('hex').slice(0, 12);
      const workerPath = resolve(output, 'sw.js');
      const worker = (await readFile(workerPath, 'utf8'))
        .replaceAll('__VTO_CACHE_VERSION__', version)
        .replace('__VTO_PRECACHE_URLS__', JSON.stringify(urls));
      await writeFile(workerPath, worker);
    },
  };
}

export default defineConfig({
  plugins: [offlineWorker()],
  server: {
    headers: developmentHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        diagnostics: resolve(root, 'diagnostics.html'),
        fitting: resolve(root, 'fit-check.html'),
        performance: resolve(root, 'performance-check.html'),
      },
      output: {
        manualChunks(id) {
          // Keep Three.js core and GLTF/environment loaders in separate
          // requests so the demo avoids one oversized vendor chunk.
          if (id.includes('/node_modules/three/examples/jsm/')) return 'three-loaders';
          if (id.includes('/node_modules/three/')) return 'three-core';
        },
      },
    },
  },
});
