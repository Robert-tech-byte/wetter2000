import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app under /wetter2000/
export default defineConfig({
  plugins: [react()],
  base: '/wetter2000/',
});
