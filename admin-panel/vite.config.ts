import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {fileURLToPath, URL} from "node:url";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/admin/" : "/",
  plugins: [react(), tailwindcss()],
  publicDir: "public",
  resolve: {alias: {
    "@/components/icons": fileURLToPath(new URL("../src/components/icons", import.meta.url)),
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  }},
  server: {
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/admin/login": { target: "http://localhost:3000", changeOrigin: true },
    },
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.tsbuildinfo",
        "**/.vite-dev.log",
        "**/inbox-preview.html",
        "**/package-lock.json",
      ],
    },
  },
}));
