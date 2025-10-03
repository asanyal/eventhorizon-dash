import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080, // local dev server
  },
  preview: {
    host: "::",
    port: 5000, // Replit expects port 5000 on deploy
    allowedHosts: [
      "eventhorizon-ui.replit.app", // your deployed domain
      ".replit.app" // allow all Replit subdomains (future-proof)
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));