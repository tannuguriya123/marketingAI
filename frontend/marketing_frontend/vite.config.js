import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'https://marketingai-kzfn.onrender.com',
        changeOrigin: true,
        secure: false, // Set to true if your backend uses a valid SSL certificate
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});

