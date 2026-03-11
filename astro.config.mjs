import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import compress from "astro-compress";
import { defineConfig } from "astro/config";

// Determine base path for GitHub Pages
// Set ASTRO_BASE_PATH=/fit/ for GitHub Pages deployment
// Leave empty for Vercel or custom domain
const base = process.env.ASTRO_BASE_PATH || "";

export default defineConfig({
  site: "https://fit.jpdiaz.dev",
  base: base,
  // output: "static" is the default - static site generation
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
