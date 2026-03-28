import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const fallbackSupabaseUrl = "https://bbalunqbiwkvvvcnjmsh.supabase.co";
const fallbackSupabasePublishableKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiYWx1bnFiaXdrdnZ2Y25qbXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODc3NTEsImV4cCI6MjA5MDI2Mzc1MX0.ji1iwiwlxCjJu5WmI8B4HV6rZGDEQS240jaSgc0p3T0";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL ?? fallbackSupabaseUrl,
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? fallbackSupabasePublishableKey,
    ),
  },
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
    cspNonce: "placeholder",
  },
  worker: { format: "es" as const },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-flow": ["@xyflow/react"],
          "dagre-layout": ["dagre"], // elkjs é carregado dinamicamente (lazy)
          "export-utils": ["html-to-image"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
