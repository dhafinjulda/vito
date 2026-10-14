/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../examples/vanilla/public/sw.js', import.meta.url), 'utf8');
const precache = ['/', '/index.html', '/assets/main-test.js'];
const script = source
  .replaceAll('__VTO_CACHE_VERSION__', 'test-version')
  .replace('__VTO_PRECACHE_URLS__', JSON.stringify(precache));
const handlers = new Map();
const stores = new Map();
let networkCalls = 0;
let networkOffline = false;
let claimed = false;
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async addAll(urls) {
        for (const path of urls) store.set(new URL(path, 'https://vto.test').href, { path, clone() { return this; } });
      },
      async match(request) { return store.get(typeof request === 'string' ? new URL(request, 'https://vto.test').href : request.url); },
      async put(request, response) { store.set(request.url, response); },
    };
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); },
};
const self = {
  location: { origin: 'https://vto.test' },
  clients: { async claim() { claimed = true; } },
  async skipWaiting() {},
  addEventListener(type, listener) { handlers.set(type, listener); },
};
const networkFetch = async () => {
  networkCalls += 1;
  if (networkOffline) throw new Error('offline');
  return { ok: true, type: 'cors', clone() { return this; }, marker: 'network' };
};
stores.set('vto-example-ancient', new Map());
stores.set('vto-example-old', new Map([
  ['https://vto.test/assets/previous-hash.js', { marker: 'previous-shell', clone() { return this; } }],
]));
vm.runInNewContext(script, { self, caches, fetch: networkFetch, URL, Set, Promise });

const installEvent = { waitUntil(promise) { this.promise = promise; } };
handlers.get('install')(installEvent);
await installEvent.promise;
assert.deepEqual([...stores.get('vto-example-test-version').keys()], precache.map(path => new URL(path, self.location.origin).href));

const activateEvent = { waitUntil(promise) { this.promise = promise; } };
handlers.get('activate')(activateEvent);
await activateEvent.promise;
assert.equal(stores.has('vto-example-ancient'), false, 'activation prunes shells older than the previous release');
assert.equal(stores.has('vto-example-old'), true, 'activation retains the previous shell for open tabs');
assert.equal(claimed, true, 'new worker claims the page');

async function request(url, { method = 'GET', mode = 'cors' } = {}) {
  const event = { request: { url, method, mode }, respondWith(value) { this.response = value; } };
  handlers.get('fetch')(event);
  return event;
}

const pinnedModel = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const firstModel = await request(pinnedModel);
assert.ok(firstModel.response, 'the exact pinned model may be cached');
assert.equal((await firstModel.response).marker, 'network');
const callsAfterModel = networkCalls;
const secondModel = await request(pinnedModel);
assert.equal((await secondModel.response).marker, 'network');
assert.equal(networkCalls, callsAfterModel, 'cached pinned model is served without a second network request');
networkOffline = true;
const previousChunk = await request('https://vto.test/assets/previous-hash.js');
assert.equal((await previousChunk.response).marker, 'previous-shell', 'a tab on the prior release can finish loading its hashed chunks');
const offlineShell = await request('https://vto.test/index.html', { mode: 'navigate' });
assert.equal((await offlineShell.response).path, '/index.html', 'pre-cached shell remains available offline');
const offlineModel = await request(pinnedModel);
assert.equal((await offlineModel.response).marker, 'network', 'previously warmed model remains available offline');
assert.equal(networkCalls, callsAfterModel, 'offline hits do not attempt network requests');

const unrelatedPage = await request('https://vto.test/private?landmarks=1', { mode: 'navigate' });
assert.equal(unrelatedPage.response, undefined, 'unknown page/query is outside the cache allowlist');
const cameraPost = await request('https://vto.test/frame', { method: 'POST' });
assert.equal(cameraPost.response, undefined, 'POST camera data bypasses the cache handler');
const versionDrift = await request('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.wasm');
assert.equal(versionDrift.response, undefined, 'unversioned third-party runtime is not cacheable');
const queryVariant = await request(`${pinnedModel}?subject=private`);
assert.equal(queryVariant.response, undefined, 'query-bearing model URLs are not cacheable');
console.log('Offline cache policy passed: versioned shell, pinned runtime allowlist, cache reuse, and private/unknown requests excluded.');
