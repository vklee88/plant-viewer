import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KEY = "plant-tracker-data";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const data = await redis.get(KEY);
    return res.status(200).json(data || null);
  }

  if (req.method === "POST") {
    const body = req.body;
    // Strip base64 images before saving to Redis to stay within size limits.
    // Images remain in localStorage only.
    const stripped = {
      ...body,
      plants: body.plants.map((p) => ({
        ...p,
        weeks: p.weeks.map((w) => ({ ...w, image: null, aiResult: null })),
      })),
    };
    await redis.set(KEY, JSON.stringify(stripped));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
