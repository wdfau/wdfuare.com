import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {rollupOptions: {output: {onlyExplicitManualChunks: true, manualChunks(id) {
    if (id.includes('node_modules/three/')) return 'three';
    if (/node_modules\/(?:@react-three|three-stdlib|maath|meshline|camera-controls)\//.test(id)) return 'scene-vendor';
  }}}},
});
