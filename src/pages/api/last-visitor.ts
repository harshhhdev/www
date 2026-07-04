import type { APIRoute } from "astro";

export const prerender = false;

const locate = async () => {
  try {
    const response = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/visitor/`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );

    const data = await response.json();

    if (data.result.includes("undefined"))
      return new Response(JSON.stringify({ result: "null" }), { status: 400 });

    return data;
  } catch (error) {
    return console.error("Error saving to Upstash:", error);
  }
};

export const GET: APIRoute = async () => {
  if (process.env.VERCEL_ENV !== "production")
    return new Response(JSON.stringify({ error: "Production only" }), {
      status: 403,
    });

  return new Response(JSON.stringify({ ...(await locate()) }));
};
