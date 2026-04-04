import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readdirSync, existsSync } from "fs";

// Auto-discover all artifact folders that contain index.html
const artifactsDir = resolve(__dirname, "artifacts");
const artifactEntries = Object.fromEntries(
  readdirSync(artifactsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(resolve(artifactsDir, d.name, "index.html")))
    .map((d) => [d.name, resolve(artifactsDir, d.name, "index.html")])
);

export default defineConfig({
  base: "/artifact-gallery/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        ...artifactEntries,
      },
    },
  },
});
