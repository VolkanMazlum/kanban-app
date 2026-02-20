import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://backend:4000",
        changeOrigin: true,
      },
    },
  },
});
