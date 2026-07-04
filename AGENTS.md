# AGENTS.md

## Learned User Preferences

- Prefer container-relative percentage values (`left`/`top` in keyframes) for decorative animations so they scale at any container size; avoid fixed pixel translates that break when card dimensions change.
- Keep designs minimal: drop section headings when not adding value (e.g. removed "Gallery" and "Connect" labels) and prefer cards to identifiable sections.
- Bento/card layouts should use fixed aspect ratios (e.g. `aspect-square`) and disable text selection (`select-none`) on grid wrappers; iterate sizing in small steps as the user requests.
- For "now playing" / cover-art cards, render a blurred, dimmed album-art background using a `<div>` with `background-image` plus an overlay (~`bg-white/70` light, `bg-neutral-900/85` dark); avoid `<img>` + `object-cover` for the blurred backdrop.
- When extracting accent colors from album art, desaturate/dim the result in dark mode so borders don't look neon against `.dark` backgrounds.
- Verify builds with `npm run build` after non-trivial changes; expect zero errors from `astro check`.
- When committing on this repo, branch off `master` into a `cursor/<topic>` branch, stage only related files, write a concise message, and push.
- When swapping or reordering bento cards, preserve each card's original aspect ratio and dimensions; never silently resize a card as a side effect of moving another.
- Scope edits narrowly: when asked to move/modify one specific block or column, do not touch unrelated blocks, columns, or files in the same change.
- Structure the bento row-per-row, not as independent masonry columns: each row is `flex flex-col gap-3 sm:grid sm:grid-cols-2` holding two large-square slots. A slot is either a single `aspect-square` card or an `aspect-square` wrapper subdivided with inner grids (`grid-rows-2` / `grid-cols-2`, `gap-3`) whose cards have no aspect classes of their own — this keeps slot heights identical because the gap is inside the square. Independent columns drift because `aspect-[2/1]` halves stacked with a gap are taller than one square.
- For text/metadata overlays on media cards, render the media at full card size and absolutely position the text container (e.g. with `m-1`) on top; do not inset, shrink, or pad the video to make room for text.
- When cropping videos via ffmpeg for bento cards, use a pure crop filter (no `scale`) — rescaling makes the result visibly blurry.
- The bento gallery has exactly 4 block kinds, and every card must be one of them: (1) large full-scale square; (2) horizontal half rectangle — 2 stacked vertically equal one large square including padding/gap; (3) vertical half rectangle — 2 side by side equal one large square including padding/gap; (4) small square — 4 of them (2 top, 2 bottom) including padding/gap equal one large square. Never use arbitrary aspect ratios (e.g. a video's native ratio) for a card.
- Each bento row spans the space of 2 large squares; fill that row with any combination of the 4 block kinds.
- Half rows also exist: half the height of a normal row, two slots wide. Each half-row slot may only hold one horizontal half rectangle or 2 small squares.

## Learned Workspace Facts

- Astro 5 static site with the Vercel adapter (`@astrojs/vercel`, `output: "static"`); canonical site is `https://www.harshsingh.me` (set via `site` in `astro.config.mjs`).
- Tailwind CSS v4 wired through `@tailwindcss/vite` (not the Astro integration); global styles live in `src/global.css`.
- Components live in `src/components/*.astro` (lowercase filenames: `header.astro`, `footer.astro`, `main.astro`, `music.astro`, `where.astro`, `layout.astro`, `post-layout.astro`).
- Pages live in `src/pages/`; server endpoints under `src/pages/api/*.ts` (current routes: `last-visitor.ts`, `lastfm.ts`, `locate.ts`, `og.ts`); MDX posts go under `src/pages/writing/`.
- Dark mode uses a `.dark` class on `<html>`, applied synchronously by an inline `is:inline` script in the head to avoid flash; CSS keys off `:global(.dark)` from scoped styles.
- Astro `<style>` blocks are scoped by default — when defining `@keyframes` consumed by a scoped class, mark the block `is:global` so the animation name resolves.
- Music section uses Last.fm (not Spotify — Spotify Web API now requires Premium for new apps); env vars: `LASTFM_API_KEY`, `LASTFM_USERNAME`.
- Last-visitor / locate features use Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`); API routes read env via `process.env` on Vercel and fall back to `import.meta.env` in local dev when `process.env` is empty.
- Bento layout lives in `src/components/main.astro` as a 2-column masonry of numbered cards; cards open external links in new tabs (`target="_blank" rel="noreferrer"`). Media goes under `public/bento/` (mostly mp4s), and shared assets like `public/disc.webp` and `public/meme.gif` sit at the public root.
- Project/showcase cards follow a consistent pattern: full-bleed media (mp4 or image) with an absolutely-positioned overlay containing the project title + a small diagonal-arrow SVG icon + a year/date label; the whole card links out (e.g. `dots.harshsingh.me`, `qursor.harshsingh.me`, `kmenu.dev`, `snip.tf`, `loomix.harshsingh.me`).
- Text-selection accent color is `#0AB7C9`; music-card Spotify glyph color is `#62dbbe`.
- Build command is `npm run build` (runs `astro sync && astro check && astro build`).
