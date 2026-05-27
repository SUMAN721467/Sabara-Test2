// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = !!process.env.VERCEL;

// On Vercel we must:
//   1. Disable the Cloudflare vite-plugin so the build output targets Vercel, not Workers.
//   2. Omit the Cloudflare server entry from TanStack Start config.
export default defineConfig({
  // Disable Cloudflare plugin entirely when building on Vercel
  cloudflare: isVercel ? false : undefined,
  tanstackStart: isVercel
    ? {}
    : {
        server: { entry: "server" },
      },
  vite: {
    build: {
      chunkSizeWarningLimit: 2000,
    },
  },
});

