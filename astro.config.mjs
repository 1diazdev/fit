import prefetch from "@astrojs/prefetch";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import compress from "astro-compress";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://fit.jpdiaz.dev",
  output: "hybrid", // Enable hybrid rendering for static pages + API routes
  integrations: [
    sitemap(),
    compress({
      css: true,
      html: true,
      js: true,
      img: false,
      svg: false,
    }),
    prefetch(),
    tailwind(),
  ],
});
