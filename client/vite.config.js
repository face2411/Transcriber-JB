import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend owns all API calls (see spec.md "Architecture Requirements" -
      // server-side API calls to fix CORS issues with Apollo/Hunter/HubSpot).
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
