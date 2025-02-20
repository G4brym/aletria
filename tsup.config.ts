import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        'aletria': 'src/index.ts',
    },
    format: ['esm'],
    outDir: 'dist',
    target: 'node20',
    platform: 'node',
    sourcemap: true,
    clean: true,
    shims: true,
    splitting: false,
    dts: false,
    banner: {
        js: '#!/usr/bin/env node',
    },
})
