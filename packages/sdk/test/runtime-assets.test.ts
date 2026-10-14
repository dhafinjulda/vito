/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { describe, expect, it } from 'vitest';
import { prepareRuntimeAssets, type RuntimeAssetServices } from '../src/tracking/runtime-assets';

const wasmRoot = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const files = { wasmLoaderPath: `${wasmRoot}/vision_wasm_internal.js`, wasmBinaryPath: `${wasmRoot}/vision_wasm_internal.wasm` };

function createServices() {
  const cached = new Map<string, Response>();
  const fetched: string[] = [];
  let online = true;
  const services: RuntimeAssetServices = {
    async openCache() {
      return {
        async match(url) { return cached.get(url)?.clone(); },
        async put(url, response) { cached.set(url, response.clone()); },
      };
    },
    async fetch(url) {
      fetched.push(url);
      if (!online) throw new Error('offline');
      const body = url.endsWith('.js') ? 'self.Module = {};' : url.endsWith('.wasm') ? new Uint8Array([0, 97, 115, 109]) : new Uint8Array([1, 2, 3]);
      const response = new Response(body);
      Object.defineProperty(response, 'type', { value: 'cors' });
      return response;
    },
  };
  return { services, cached, fetched, setOnline(value: boolean) { online = value; } };
}

describe('pinned runtime asset cache', () => {
  it('is opt-in and leaves custom runtime URLs untouched', async () => {
    const mock = createServices();
    const result = await prepareRuntimeAssets(files, modelUrl, false, mock.services);
    expect(result.files).toEqual(files);
    expect(result.modelAssetPath).toBe(modelUrl);
    expect(mock.fetched).toEqual([]);
    await result.dispose();

    const custom = await prepareRuntimeAssets(files, 'https://example.test/model.task', true, mock.services);
    expect(custom.files).toEqual(files);
    expect(custom.modelAssetPath).toBe('https://example.test/model.task');
    expect(mock.fetched).toEqual([]);
  });

  it('caches only the pinned loader, WASM and model and passes model bytes to MediaPipe', async () => {
    const mock = createServices();
    const result = await prepareRuntimeAssets(files, modelUrl, true, mock.services);
    expect(mock.fetched).toEqual([files.wasmLoaderPath, files.wasmBinaryPath, modelUrl]);
    expect([...mock.cached.keys()].sort()).toEqual([files.wasmBinaryPath, files.wasmLoaderPath, modelUrl].sort());
    expect(result.files).toEqual(files);
    expect([...result.modelAssetBuffer!]).toEqual([1, 2, 3]);
    result.dispose();
    result.dispose();
  });

  it('reuses warmed runtime bytes with the network unavailable', async () => {
    const mock = createServices();
    const first = await prepareRuntimeAssets(files, modelUrl, true, mock.services);
    first.dispose();
    mock.setOnline(false);
    const second = await prepareRuntimeAssets(files, modelUrl, true, mock.services);
    expect(mock.fetched).toHaveLength(3);
    expect(second.modelAssetBuffer).toBeInstanceOf(Uint8Array);
    second.dispose();
  });

  it('does not persist assets served without CORS approval', async () => {
    const mock = createServices();
    const rejectingServices: RuntimeAssetServices = {
      ...mock.services,
      async fetch(url) {
        const response = new Response('blocked');
        Object.defineProperty(response, 'type', { value: 'opaque' });
        return response;
      },
    };
    await expect(prepareRuntimeAssets(files, modelUrl, true, rejectingServices)).rejects.toThrow('could not be cached');
    expect(mock.cached.size).toBe(0);
  });

  it('falls back to MediaPipe URLs when browser storage is unavailable', async () => {
    const mock = createServices();
    const unavailable: RuntimeAssetServices = {
      ...mock.services,
      async openCache() { throw new Error('storage disabled'); },
    };
    const result = await prepareRuntimeAssets(files, modelUrl, true, unavailable);
    expect(result.files).toEqual(files);
    expect(result.modelAssetPath).toBe(modelUrl);
    expect(result.modelAssetBuffer).toBeUndefined();
    expect(mock.fetched).toEqual([]);
  });
});
