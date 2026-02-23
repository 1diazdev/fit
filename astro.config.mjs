import prefetch from "@astrojs/prefetch";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import compress from "astro-compress";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://fit.jpdiaz.dev",
  // output: "static" is the default - Netlify Functions are separate
  // For Vercel with API routes, you would use: output: "server"
  integrations: [
    sitemap(),
    compress({
      css: true,
      html: true,
      js: true,
      img: false,
      svg: false,
    }),
    // prefetch(), // Temporarily disabled - may interfere with query params
    tailwind(),
  ],
});
