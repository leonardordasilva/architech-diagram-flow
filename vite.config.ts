import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const FALLBACK_SUPABASE_PROJECT_ID = "bbalunqbiwkvvvcnjmsh";
const FALLBACK_SUPABASE_URL = `https://${FALLBACK_SUPABASE_PROJECT_ID}.supabase.co`;
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiYWx1bnFiaXdrdnZ2Y25qbXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODc3NTEsImV4cCI6MjA5MDI2Mzc1MX0.ji1iwiwlxCjJu5WmI8B4HV6rZGDEQS240jaSgc0p3T0";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const projectId = env.VITE_SUPABASE_PROJECT_ID?.trim() || FALLBACK_SUPABASE_PROJECT_ID;
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || `https://${projectId}.supabase.co` || FALLBACK_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return {
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
    define: {
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(projectId),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publishableKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(publishableKey),
    },
    html: {
      cspNonce: "placeholder",
    },
    worker: { format: "es" as const },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-flow": ["@xyflow/react"],
            "dagre-layout": ["dagre"],
            "export-utils": ["html-to-image"],
            supabase: ["@supabase/supabase-js"],
          },
        },
      },
    },
  };
});
