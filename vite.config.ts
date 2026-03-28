import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // R11: CSP nonce — Vite replaces 'nonce-placeholder' with the real nonce at build time
  html: {
    cspNonce: 'placeholder',
  },
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-flow': ['@xyflow/react'],
          'dagre-layout': ['dagre'], // elkjs é carregado dinamicamente (lazy)
          'export-utils': ['html-to-image'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
}));
