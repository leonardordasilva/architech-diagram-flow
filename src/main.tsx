import { createRoot } from "react-dom/client";
import "./index.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (projectId ? `https://${projectId}.supabase.co` : "");
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "[FATAL] Missing backend environment variables.\n" +
    `  VITE_SUPABASE_PROJECT_ID: ${projectId ? "✓" : "✗ MISSING"}\n` +
    `  VITE_SUPABASE_URL: ${supabaseUrl ? "✓" : "✗ MISSING"}\n` +
    `  VITE_SUPABASE_PUBLISHABLE_KEY: ${supabaseKey ? "✓" : "✗ MISSING"}`
  );
}

import("./App.tsx").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(<App />);
});
