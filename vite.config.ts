import path from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  build: {
    minify: 'esbuild',
    outDir: 'dist',
    sourcemap: false,
  },
  optimizeDeps: {
    exclude: [
      '@ffmpeg/ffmpeg',
      '@ffmpeg/util',
      '@xenova/transformers', // WASM-based AI models
      '@mediapipe/tasks-vision', // WebGL-based segmentation
    ],
    include: [
      'react',
      'react-dom',
      'lucide-react',
      'sonner',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
  },
  plugins: [
    react(),
    basicSsl(),
    {
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          next();
        });
      },
      name: 'configure-response-headers',
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
});
