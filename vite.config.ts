import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import fs from "fs";

const FALLBACK_SUPABASE_PROJECT_ID = "bbalunqbiwkvvvcnjmsh";
const FALLBACK_SUPABASE_URL = `https://${FALLBACK_SUPABASE_PROJECT_ID}.supabase.co`;
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiYWx1bnFiaXdrdnZ2Y25qbXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODc3NTEsImV4cCI6MjA5MDI2Mzc1MX0.ji1iwiwlxCjJu5WmI8B4HV6rZGDEQS240jaSgc0p3T0";

/** Load .env.defaults as fallback values */
function loadDefaults(): Record<string, string> {
  const defaults: Record<string, string> = {};
  try {
    const content = fs.readFileSync(path.resolve(__dirname, ".env.defaults"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      defaults[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  } catch {
    // .env.defaults not found — use inline fallbacks below
  }
  return defaults;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const defaults = loadDefaults();

  const projectId =
    env.VITE_SUPABASE_PROJECT_ID?.trim() ||
    env.SUPABASE_PROJECT_ID?.trim() ||
    defaults.VITE_SUPABASE_PROJECT_ID ||
    FALLBACK_SUPABASE_PROJECT_ID;
  const supabaseUrl =
    env.VITE_SUPABASE_URL?.trim() ||
    env.SUPABASE_URL?.trim() ||
    defaults.VITE_SUPABASE_URL ||
    FALLBACK_SUPABASE_URL;
  const publishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.VITE_SUPABASE_ANON_KEY?.trim() ||
    env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.SUPABASE_ANON_KEY?.trim() ||
    defaults.VITE_SUPABASE_PUBLISHABLE_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      ...(env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: env.SENTRY_ORG || "microflow",
              project: env.SENTRY_PROJECT || "microflow-architect",
              authToken: env.SENTRY_AUTH_TOKEN,
              telemetry: false,
              sourcemaps: {
                filesToDeleteAfterUpload: ["./dist/**/*.map"],
              },
            }),
          ]
        : []),
    ],
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
      sourcemap: 'hidden',
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
