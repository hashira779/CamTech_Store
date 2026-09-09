import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5005,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mystore/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@mystore/ui/styles.css': path.resolve(__dirname, '../../packages/ui/styles.css'),
      '@mystore/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  build: {
    target: 'esnext',
    cssMinify: true,
  },
});
