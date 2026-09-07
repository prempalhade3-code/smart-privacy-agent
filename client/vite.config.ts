/// <reference types="@webgpu/types" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        offscreen: "src/offscreen/offscreen.html",
      },
    },
  },
});
