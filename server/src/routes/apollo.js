// Apollo.io calls, moved server-side to fix the CORS block the original
// artifact hit calling Apollo directly from the browser (see
// vee-claude-code-handoff.md "Features to Add in Rebuild - High priority").
// Employee count verification, domain lookup, and contact enrichment.

import { Router } from "express";
import { config } from "../config.js";

export const apolloRouter = Router();

function requireKey(res) {
  if (!config.apolloApiKey) {
    res.status(501).json({ error: "APOLLO_API_KEY is not configured on the server" });
    return false;
  }
  return true;
}

// Looks up a company by name/domain to verify employee count and get a
// canonical domain - used by the "Verify Size" link on Step 2 company cards.
apolloRouter.post("/organization-search", async (req, res, next) => {
  if (!requireKey(res)) return;
  try {
    const { name, domain } = req.body || {};
    if (!name && !domain) return res.status(400).json({ error: "name or domain is required" });

    const params = new URLSearchParams();
    if (domain) params.set("domains[]", domain);
    if (name) params.set("q_organization_name", name);

    const r = await fetch(`https://api.apollo.io/v1/organizations/search?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.apolloApiKey },
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error || "Apollo organization search failed", detail: data });

    const org = data.organizations?.[0] || null;
    res.json({
      found: Boolean(org),
      name: org?.name || null,
      domain: org?.primary_domain || null,
      estimated_num_employees: org?.estimated_num_employees ?? null,
      industry: org?.industry || null,
      linkedin_url: org?.linkedin_url || null,
    });
  } catch (err) {
    next(err);
  }
});

// Contact enrichment by name + company domain - fills in title/seniority/
// LinkedIn URL when available, ahead of a manual LinkedIn profile paste.
apolloRouter.post("/people-match", async (req, res, next) => {
  if (!requireKey(res)) return;
  try {
    const { firstName, lastName, domain } = req.body || {};
    if (!lastName || !domain) return res.status(400).json({ error: "lastName and domain are required" });

    const r = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.apolloApiKey },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, domain }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error || "Apollo people match failed", detail: data });

    const person = data.person || null;
    res.json({
      found: Boolean(person),
      name: person?.name || null,
      title: person?.title || null,
      seniority: person?.seniority || null,
      linkedin_url: person?.linkedin_url || null,
      email: person?.email || null,
    });
  } catch (err) {
    next(err);
  }
});
