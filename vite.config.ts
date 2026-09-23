import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({ base: './', plugins: [react()], server: { host: '127.0.0.1' }, build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),
      beach: resolve(__dirname, 'beach/index.html'),
      debugMap: resolve(__dirname, 'debug/map/index.html'),
    },
    output: { manualChunks: { three: ['three', 'three/addons/controls/OrbitControls.js'] } }
  }
} });
