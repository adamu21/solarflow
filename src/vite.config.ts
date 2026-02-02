// src/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.',        // src is the root
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});