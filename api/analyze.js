export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
  {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    }
  );

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  response.body.pipeTo(
    new WritableStream({
      write(chunk) { res.write(chunk); },
      close() { res.end(); },
    })
  );
}