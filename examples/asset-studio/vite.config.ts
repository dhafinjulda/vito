/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5174, strictPort: true },
  build: { target: 'es2022', rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/node_modules/three/examples/jsm/')) return 'three-loaders';
    if (id.includes('/node_modules/three/')) return 'three-core';
  } } } },
});
