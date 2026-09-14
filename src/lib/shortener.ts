import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";

const env = (key: string): string =>
  (process.env[key] as string | undefined) ||
  (import.meta.env[key] as string | undefined) ||
  "";

const SESSION_COOKIE = "shortener_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Reserved single-segment paths that should never resolve as a short slug,
// because they collide with real routes/files on this site.
const RESERVED_SLUGS = new Set([
  "shortener",
  "api",
  "writing",
  "ricing",
  "rss.xml",
  "sitemap.xml",
  "favicon.ico",
  "robots.txt",
  "og.png",
  "404",
  "",
]);

// A slug is unrestricted in shape; we only reject what would break routing
// or collide with real site paths.
export const isValidSlugShape = (slug: string): boolean =>
  slug.length > 0 && !slug.includes("/");

const restUrl = (): string => env("UPSTASH_REDIS_REST_URL");
const restToken = (): string => env("UPSTASH_REDIS_REST_TOKEN");

// HMAC key is derived from the password so rotating the password
// invalidates every existing session, and the raw password is never
// written to Redis or to any cookie. The key is stored as a hex string
// so the consuming `createHmac` call sees a plain `BinaryLike`.
const sessionKey = (): string =>
  createHmac("sha256", "shortener-session-v1")
    .update(env("SHORTENER_PASSWORD"))
    .digest("hex");

const sign = (payload: string): string =>
  createHmac("sha256", sessionKey()).update(payload).digest("base64url");

const safeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
};

export const isPasswordConfigured = (): boolean =>
  env("SHORTENER_PASSWORD").length > 0;

export const verifyPassword = (input: string): boolean => {
  const expected = env("SHORTENER_PASSWORD");
  if (!expected) return false;
  if (input.length === 0) return false;
  return safeEqual(input, expected);
};

export const createSessionToken = (): string => {
  const expSeconds = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `${expSeconds}.${nonce}`;
  return `${payload}.${sign(payload)}`;
};

export const isAuthenticated = (cookies: AstroCookies): boolean => {
  const raw = cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts as [string, string, string];
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000))
    return false;
  const expected = sign(`${expStr}.${nonce}`);
  return safeEqual(sig, expected);
};

export const setSessionCookie = (
  cookies: AstroCookies,
  token: string,
): void => {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
};

export const clearSessionCookie = (cookies: AstroCookies): void => {
  cookies.delete(SESSION_COOKIE, { path: "/" });
};

// --- URL + slug helpers --------------------------------------------------

export const normalizeLongUrl = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const isReservedSlug = (slug: string): boolean =>
  RESERVED_SLUGS.has(slug.toLowerCase());

const SLUG_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const generateSlug = (length = 7): string => {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[bytes[i]! % SLUG_ALPHABET.length];
  }
  return out;
};

// --- Upstash Redis REST wrapper -----------------------------------------

type RedisResult<T> = { result: T } | { error: string };

const redisCommand = async <T>(command: (string | number)[]): Promise<T> => {
  const res = await fetch(restUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${restToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const data = (await res.json()) as RedisResult<T>;
  if ("error" in data) throw new Error(data.error);
  return data.result;
};

const redisPipeline = async (
  commands: (string | number)[][],
): Promise<unknown[]> => {
  if (commands.length === 0) return [];
  const res = await fetch(`${restUrl()}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${restToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  const data = (await res.json()) as RedisResult<unknown>[];
  return data.map((entry) => {
    if ("error" in entry) throw new Error(entry.error);
    return entry.result;
  });
};

export type ShortLink = {
  slug: string;
  url: string;
  clicks: number;
  createdAt: number;
};

export const slugExists = async (slug: string): Promise<boolean> => {
  const result = await redisCommand<number>(["EXISTS", `url:${slug}`]);
  return result === 1;
};

export const getLongUrl = async (slug: string): Promise<string | null> => {
  const result = await redisCommand<string | null>(["GET", `url:${slug}`]);
  return result ?? null;
};

export const incrementClicks = async (slug: string): Promise<void> => {
  await redisCommand<number>(["INCR", `clicks:${slug}`]);
};

export const createShortLink = async (
  slug: string,
  longUrl: string,
): Promise<void> => {
  const now = Date.now();
  await redisPipeline([
    ["SET", `url:${slug}`, longUrl],
    ["SET", `created_at:${slug}`, String(now)],
    ["SADD", "shortener:slugs", slug],
  ]);
};

export const deleteShortLink = async (slug: string): Promise<void> => {
  await redisPipeline([
    ["DEL", `url:${slug}`],
    ["DEL", `clicks:${slug}`],
    ["DEL", `created_at:${slug}`],
    ["SREM", "shortener:slugs", slug],
  ]);
};

export type UpdateOptions = {
  newSlug?: string;
  newUrl?: string;
};

// Update a slug's destination URL and/or rename it. Renames are
// implemented as SET-on-new + DEL-on-old (rather than RENAME) so we
// gracefully handle pre-existing slugs whose `clicks:` or `created_at:`
// keys were never written. Concurrent INCRs between read and write
// would lose at most a single click, which is acceptable here.
export const updateShortLink = async (
  slug: string,
  opts: UpdateOptions,
): Promise<void> => {
  const targetSlug = opts.newSlug && opts.newSlug !== slug ? opts.newSlug : slug;
  const renaming = targetSlug !== slug;

  if (!renaming) {
    if (opts.newUrl) {
      await redisCommand<"OK">(["SET", `url:${slug}`, opts.newUrl]);
    }
    return;
  }

  const values = await redisPipeline([
    ["GET", `url:${slug}`],
    ["GET", `clicks:${slug}`],
    ["GET", `created_at:${slug}`],
  ]);
  const currentUrl = values[0] as string | null;
  if (!currentUrl) throw new Error("slug not found");

  const finalUrl = opts.newUrl ?? currentUrl;
  const clicks = values[1] as string | null;
  const createdAt = values[2] as string | null;

  const commands: (string | number)[][] = [
    ["SET", `url:${targetSlug}`, finalUrl],
    ["DEL", `url:${slug}`],
    ["SREM", "shortener:slugs", slug],
    ["SADD", "shortener:slugs", targetSlug],
  ];
  if (clicks !== null) {
    commands.push(["SET", `clicks:${targetSlug}`, clicks]);
    commands.push(["DEL", `clicks:${slug}`]);
  }
  if (createdAt !== null) {
    commands.push(["SET", `created_at:${targetSlug}`, createdAt]);
    commands.push(["DEL", `created_at:${slug}`]);
  }
  await redisPipeline(commands);
};

export const listShortLinks = async (): Promise<ShortLink[]> => {
  const slugs = await redisCommand<string[]>(["SMEMBERS", "shortener:slugs"]);
  if (!slugs || slugs.length === 0) return [];

  const commands: (string | number)[][] = [];
  for (const slug of slugs) {
    commands.push(["GET", `url:${slug}`]);
    commands.push(["GET", `clicks:${slug}`]);
    commands.push(["GET", `created_at:${slug}`]);
  }
  const results = await redisPipeline(commands);

  const links: ShortLink[] = [];
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]!;
    const url = results[i * 3] as string | null;
    const clicksRaw = results[i * 3 + 1] as string | null;
    const createdRaw = results[i * 3 + 2] as string | null;
    if (!url) continue;
    links.push({
      slug,
      url,
      clicks: clicksRaw ? Number(clicksRaw) : 0,
      createdAt: createdRaw ? Number(createdRaw) : 0,
    });
  }

  links.sort((a, b) => b.createdAt - a.createdAt);
  return links;
};
