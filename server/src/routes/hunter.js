// Hunter.io email lookup, moved server-side - the original artifact's
// direct browser call to api.hunter.io was blocked by CORS (see
// vee-claude-code-handoff.md, "manual link fallback only currently").

import { Router } from "express";
import { config } from "../config.js";

export const hunterRouter = Router();

hunterRouter.post("/email-finder", async (req, res, next) => {
  if (!config.hunterApiKey) {
    return res.status(501).json({ error: "HUNTER_API_KEY is not configured on the server" });
  }
  try {
    const { domain, firstName, lastName } = req.body || {};
    if (!domain || !lastName) return res.status(400).json({ error: "domain and lastName are required" });

    const params = new URLSearchParams({
      domain,
      first_name: firstName || "",
      last_name: lastName,
      api_key: config.hunterApiKey,
    });
    const r = await fetch(`https://api.hunter.io/v2/email-finder?${params.toString()}`);
    const data = await r.json();
    if (data.errors?.length) {
      return res.status(r.status === 200 ? 502 : r.status).json({ error: data.errors[0].details || "Hunter API error" });
    }

    const d = data.data;
    if (!d?.email) return res.json({ found: false, domain });

    const score = d.score ?? 0;
    res.json({
      found: true,
      email: d.email,
      score,
      confidence: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
      sources: d.sources?.length || 0,
      domain,
    });
  } catch (err) {
    next(err);
  }
});
