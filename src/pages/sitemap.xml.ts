import type { APIContext } from "astro";

// Single-file sitemap. @astrojs/sitemap always emits an index plus a numbered
// file, which is overkill for a site this size, so we enumerate the static
// page modules ourselves and serve one urlset.
export const prerender = true;

const EXCLUDED = [
  /\/404$/, // error page
  /\[.*\]/, // dynamic routes (short-link redirects)
  /^\/shortener(\/|$)/, // private admin UI, also disallowed in robots.txt
  /^\/api(\/|$)/, // JSON/redirect endpoints
];

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const GET = (context: APIContext) => {
  const site = context.site ?? new URL("https://www.harshsingh.me");
  const pages = import.meta.glob("./**/*.{astro,mdx}");

  const routes = Object.keys(pages)
    .map((path) =>
      path
        .replace(/^\.\//, "/")
        .replace(/\.(astro|mdx)$/, "")
        .replace(/\/index$/, ""),
    )
    .filter((route) => !EXCLUDED.some((pattern) => pattern.test(route)))
    .map((route) => (route === "" ? "/" : `${route}/`))
    .sort((a, b) => a.localeCompare(b));

  const urls = routes
    .map((route) => `<url><loc>${escapeXml(new URL(route, site).href)}</loc></url>`)
    .join("");

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
