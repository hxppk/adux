import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import adux from "@adux/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    adux({
      runtime: { debug: true },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
