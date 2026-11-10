import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { staticAssetsAdapter } from "@vinext/cloudflare/cache/static-assets-adapter";

// Cloudflare Workers build (docs/CLOUDFLARE_MIGRATION.md); production runs this.
// `next build` still works and is what the e2e suites run against.
export default defineConfig({
  plugins: [
    // Pages Next also marks static are prerendered at build and served from
    // Workers Static Assets; dynamic and signed-in routes are skipped.
    vinext({
      cache: { cdn: staticAssetsAdapter() },
      prerender: { routes: "*" },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
