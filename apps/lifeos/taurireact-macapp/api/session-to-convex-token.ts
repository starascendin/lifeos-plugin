import type { VercelRequest, VercelResponse } from "@vercel/node";

const CLERK_API_URL = "https://api.clerk.com/v1";
const CONVEX_JWT_TEMPLATE = "convex";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS: Capacitor origin can vary (https://localhost, capacitor://localhost, etc.)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.error("CLERK_SECRET_KEY not configured");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const url = `${CLERK_API_URL}/sessions/${encodeURIComponent(
      sessionId
    )}/tokens/${CONVEX_JWT_TEMPLATE}`;

    const tokenResp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const data = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok) {
      console.error("Failed to mint Convex JWT:", tokenResp.status, data);
      return res.status(401).json({ error: "Failed to mint token" });
    }

    const jwt = (data as any).jwt;
    if (!jwt || typeof jwt !== "string") {
      console.error("Unexpected token response shape:", data);
      return res.status(500).json({ error: "Invalid token response from Clerk" });
    }

    return res.status(200).json({ jwt });
  } catch (e: any) {
    console.error("session-to-convex-token error:", e);
    return res.status(500).json({ error: e?.message || "Internal server error" });
  }
}

