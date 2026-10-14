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
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'vto-sdk' },
    target: 'es2022',
    sourcemap: true,
    rollupOptions: { external: ['three', 'three/addons/loaders/GLTFLoader.js'] },
  },
  // Vite can retain transformed worker responses under a fixed dist URL during
  // rebuilds. Content-address the worker so a new SDK cannot receive old IPC.
  worker: { format: 'es', rollupOptions: { output: { entryFileNames: 'assets/face-worker-[hash].js' } } },
});
