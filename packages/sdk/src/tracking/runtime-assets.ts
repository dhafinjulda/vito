/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
interface WasmFiles {
  wasmLoaderPath: string;
  wasmBinaryPath: string;
}

interface RuntimeCache {
  match(request: string): Promise<Response | undefined>;
  put(request: string, response: Response): Promise<void>;
}

export interface RuntimeAssets {
  files: WasmFiles;
  modelAssetPath?: string;
  modelAssetBuffer?: Uint8Array;
  dispose(): void;
}

export interface RuntimeAssetServices {
  openCache(): Promise<RuntimeCache>;
  fetch(url: string): Promise<Response>;
}

const RUNTIME_CACHE = 'vto-mediapipe-runtime-0.10.22-rc.20250304';
const DEFAULT_WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
const DEFAULT_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const ALLOWED_WASM = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@0\.10\.22-rc\.20250304\/wasm\/vision_wasm_(?:nosimd_)?internal\.(?:js|wasm)$/;

const browserServices: RuntimeAssetServices = {
  async openCache() {
    return caches.open(RUNTIME_CACHE);
  },
  fetch(url) {
    return fetch(url, { mode: 'cors', credentials: 'omit' });
  },
};

function isApprovedRuntime(files: WasmFiles, modelAssetPath: string): boolean {
  return files.wasmLoaderPath.startsWith(`${DEFAULT_WASM_ROOT}/`)
    && files.wasmBinaryPath.startsWith(`${DEFAULT_WASM_ROOT}/`)
    && ALLOWED_WASM.test(files.wasmLoaderPath)
    && ALLOWED_WASM.test(files.wasmBinaryPath)
    && modelAssetPath === DEFAULT_MODEL;
}

async function getCachedResponse(cache: RuntimeCache, url: string, fetchAsset: RuntimeAssetServices['fetch']): Promise<Response> {
  const cached = await cache.match(url);
  if (cached) return cached;
  const response = await fetchAsset(url);
  if (!response.ok || (response.type !== 'cors' && response.type !== 'basic')) {
    throw new Error(`MediaPipe runtime asset could not be cached: ${new URL(url).pathname}`);
  }
  try {
    await cache.put(url, response.clone());
  } catch {
    // CacheStorage is an optimization: quota or policy failures must not break an online try-on session.
  }
  return response;
}

/** Cache only pinned static engine/model files; face-derived runtime data never enters this path. */
export async function prepareRuntimeAssets(
  files: WasmFiles,
  modelAssetPath: string,
  enabled: boolean,
  services: RuntimeAssetServices = browserServices,
): Promise<RuntimeAssets> {
  if (!enabled || !isApprovedRuntime(files, modelAssetPath)) {
    return { files, modelAssetPath, dispose() {} };
  }

  let cache: RuntimeCache;
  try {
    cache = await services.openCache();
  } catch {
    return { files, modelAssetPath, dispose() {} };
  }
  const [loaderResponse, wasmResponse, modelResponse] = await Promise.all([
    getCachedResponse(cache, files.wasmLoaderPath, services.fetch),
    getCachedResponse(cache, files.wasmBinaryPath, services.fetch),
    getCachedResponse(cache, modelAssetPath, services.fetch),
  ]);
  // These fetches warm the browser HTTP cache used by MediaPipe's importScripts/WASM loader.
  // The model bytes are passed directly so model initialization itself can use CacheStorage while offline.
  const modelBytes = await modelResponse.arrayBuffer();
  return {
    files,
    modelAssetBuffer: new Uint8Array(modelBytes),
    dispose() {},
  };
}
