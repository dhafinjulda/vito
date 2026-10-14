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
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'asset-generator' },
    target: 'es2022',
    sourcemap: true,
    rollupOptions: { external: ['three'] },
  },
});
