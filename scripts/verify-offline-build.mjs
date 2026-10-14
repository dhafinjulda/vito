/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(fileURLToPath(new URL('../examples/vanilla/dist/', import.meta.url)));
const worker = await readFile(resolve(dist, 'sw.js'), 'utf8');
const headers = await readFile(resolve(dist, '_headers'), 'utf8');
assert.ok(!worker.includes('__VTO_'), 'service worker placeholders must be replaced at build time');
const cacheName = worker.match(/const CACHE_NAME = `vto-example-([a-f0-9]{12})`;/)?.[1];
assert.ok(cacheName, 'service worker has a content-versioned cache name');
const urlsText = worker.match(/const PRECACHE_URLS = (\[[^\n]+\]);/)?.[1];
assert.ok(urlsText, 'service worker has generated shell URLs');
const urls = JSON.parse(urlsText);
for (const url of urls) {
  assert.ok(url.startsWith('/') && !url.includes('?') && !url.includes('#'), `precache entry is a clean same-origin path: ${url}`);
  await access(resolve(dist, url === '/' ? 'index.html' : `.${url}`));
}
for (const required of ['/index.html', '/diagnostics.html', '/fit-check.html', '/favicon.svg', '/glasses.glb', '/glasses-alt.glb', '/round-spectacles.glb', '/vto-face-worker.js']) {
  assert.ok(urls.includes(required), `required example resource is precached: ${required}`);
}
assert.ok(worker.includes('tasks-vision@0\\.10\\.22-rc\\.20250304'), 'runtime cache matches the exact pinned version');
assert.ok(worker.includes('/face_landmarker/float16/1/face_landmarker.task'), 'model cache uses the exact pinned model path');
assert.match(headers, /Content-Security-Policy:/);
assert.match(headers, /worker-src 'self' blob:/);
assert.doesNotMatch(headers, /script-src[^;]*blob:/, 'blob execution is not enabled for script-src');
assert.match(headers, /Permissions-Policy: camera=\(self\), microphone=\(\)/);
assert.match(headers, /Strict-Transport-Security:/);
console.log(`Offline production build verified: ${urls.length} local resources, content cache ${cacheName}, pinned MediaPipe allowlist, and deployment headers.`);
