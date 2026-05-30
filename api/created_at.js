export default function handler(req, res) {
  const origin = req.headers.origin || "";

  const allowedOrigins = new Set([
    "https://landquart.github.io",
    "http://localhost:3000",
    "http://localhost:5173"
  ]);

  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigins.has(origin) ? origin : "https://landquart.github.io"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return res.status(200).json({
    created_at: new Date().toISOString()
  });
}
