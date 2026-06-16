import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/gestio/",
  server: {
    host: "0.0.0.0", // accessible des d'altres màquines a la xarxa
    port: 5174,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
