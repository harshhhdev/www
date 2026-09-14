import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import rehypeExternalLinks from "rehype-external-links";

// https://astro.build/config
export default defineConfig({
  site: "https://www.harshsingh.me",
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
  output: "static",
  adapter: vercel(),
  build: {
    // Inline every stylesheet directly into <head> so the first paint isn't
    // blocked on a separate CSS round-trip. The site only ships one combined
    // Tailwind bundle (~45KB raw / ~8KB gzipped) shared across all pages,
    // so the HTML bloat is small and the saved RTT is meaningful for LCP.
    inlineStylesheets: "always",
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark-dimmed",
      },
      defaultColor: false,
    },
    rehypePlugins: [
      [
        rehypeExternalLinks,
        {
          target: "_blank",
          rel: ["noreferrer"],
        },
      ],
    ],
  },
});
