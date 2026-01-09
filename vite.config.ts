import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Replace 'data-capture' with your repository name if different
  base: '/data-capture/',
  build: {
    outDir: 'dist',
  }
});