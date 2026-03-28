import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Fail-fast: validate required Supabase env vars before anything renders
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "[FATAL] Missing Supabase environment variables.\n" +
    `  VITE_SUPABASE_URL: ${supabaseUrl ? "✓" : "✗ MISSING"}\n` +
    `  VITE_SUPABASE_PUBLISHABLE_KEY: ${supabaseKey ? "✓" : "✗ MISSING"}\n` +
    "Check your .env file or deployment environment."
  );
}
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";

createRoot(document.getElementById("root")!).render(<App />);
