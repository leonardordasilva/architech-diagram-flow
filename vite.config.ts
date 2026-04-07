import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const projectId = env.VITE_SUPABASE_PROJECT_ID?.trim();
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || (projectId ? `https://${projectId}.supabase.co` : "");
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || "";

  if (!supabaseUrl) {
    throw new Error("[FATAL] Missing VITE_SUPABASE_URL and unable to derive it from VITE_SUPABASE_PROJECT_ID.");
  }

  if (!publishableKey) {
    throw new Error("[FATAL] Missing VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

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
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publishableKey),
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
