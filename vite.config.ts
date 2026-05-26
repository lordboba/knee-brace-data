import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              priority: 3,
              test: /node_modules[\\/](react|react-dom|scheduler)/
            },
            {
              maxSize: 450_000,
              name: "three-vendor",
              priority: 2,
              test: /node_modules[\\/](three|@react-three|@pmndrs|maath|troika|zustand|react-reconciler|suspend-react|its-fine|react-use-measure)/
            },
            {
              maxSize: 450_000,
              name: "vendor",
              priority: 1,
              test: /node_modules/
            }
          ]
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
