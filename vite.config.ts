import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.AIRBOOKING_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
          if (
            id.includes("/node_modules/postprocessing/") ||
            id.includes("/node_modules/@react-three/postprocessing/")
          ) {
            return "three-effects";
          }
        },
      },
    },
  },
});
