export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }
    );
  } catch (e) {
    return res.status(502).json({ error: "Failed to reach Gemini API: " + e.message });
  }

  if (!response.ok) {
    let message = `Gemini API error: HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = err?.error?.message || message;
    } catch { /* ignore parse error */ }
    return res.status(response.status).json({ error: message });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    response.body.pipeTo(
      new WritableStream({
        write(chunk) { res.write(chunk); },
        close() { res.end(); },
        abort(e) { res.end(); console.error("Stream aborted:", e); },
      })
    );
  } catch (e) {
    res.end();
    console.error("Streaming error:", e);
  }
}