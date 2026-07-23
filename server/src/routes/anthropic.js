// All Claude-backed BD intelligence endpoints. Every call here used to run
// client-side directly against api.anthropic.com (CORS-exposed API key,
// no server to enforce token minimums or check res.ok before parsing) -
// see vee-claude-code-handoff.md "Why We're Rebuilding" and "API calls".
// Moving it here fixes both: the key never reaches the browser, and every
// call path checks for failure before trying to parse a response.
//
// Prompt bodies are ported from the original vee-platform.jsx artifact
// (see vee-claude-code-handoff.md "What Works Well (Keep Exactly)") -
// CORE_RULES, the signal type instructions, the two-step news intelligence
// pattern, and the opening construction method are all copied verbatim,
// not summarized. The one deliberate deviation from the original spec is
// the boolean search strings: the original had four static templates per
// service line; this rebuild generates them per company instead, based on
// that company's actual matched signals and service line fit.

import { Router } from "express";
import { SIGNAL_TYPES } from "@vee/shared";
import { CORE_RULES, JSON_ONLY_SUFFIX } from "../prompts/coreRules.js";
import { complete, completeJSON, completeWithWebSearch } from "../lib/anthropic.js";

export const anthropicRouter = Router();

// Wraps a route handler so a missing API key (thrown as a 501 by
// lib/anthropic.js) or any other failure comes back as a clean JSON error
// instead of an unhandled rejection / generic 500.
function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message, raw: err.raw });
    }
  };
}

// -- Step 1: AI vertical recommendation --------------------------------------
anthropicRouter.post("/vertical-recommendation", handler(async (req, res) => {
  const schema = JSON.stringify({
    focuses: [
      { rank: 1, vertical: "vertical name", rationale: "2-3 sentences", signal_pattern: "observable signals", entry_title: "best job title", entry_rationale: "why this title", urgency: "High | Medium | Low" },
      { rank: 2, vertical: "vertical name", rationale: "2-3 sentences", signal_pattern: "observable signals", entry_title: "best job title", entry_rationale: "why this title", urgency: "High | Medium | Low" },
      { rank: 3, vertical: "vertical name", rationale: "2-3 sentences", signal_pattern: "observable signals", entry_title: "best job title", entry_rationale: "why this title", urgency: "High | Medium | Low" },
    ],
  });
  const prompt = `Based on Vee Technologies service lines and ICP, reason about the top 3 different verticals with the highest opportunity concentration RIGHT NOW based on macro market patterns. Active motions: alumni persona (leaders who managed offshore delivery now at companies without it), Building X alumni (facilities leaders at mid-market), data center construction capacity, AEC/BIM firms scaling VDC without offshore production. Each vertical must be genuinely different. Return JSON matching this schema exactly: ${schema}`;
  const { data, usage } = await completeJSON({
    system: CORE_RULES + JSON_ONLY_SUFFIX,
    prompt,
    maxTokens: 1000,
  });
  if (!data?.focuses?.length) return res.status(502).json({ error: "Reasoning parse failed", raw: data });
  res.json({ ...data, usage });
}));

// -- Fast Mode: two-step research + ICP assessment for one named company ----
anthropicRouter.post("/fast-research", handler(async (req, res) => {
  const { company, url, vertical } = req.body || {};
  if (!company) return res.status(400).json({ error: "company is required" });

  const search = await completeWithWebSearch({
    system: "You are a business intelligence researcher. Search for recent information about this company and summarize findings in plain text. No JSON, no formatting.",
    prompt: `Research "${company}"${url ? ` (website: ${url})` : ""}. Find: what they do, their approximate employee count, industry vertical, recent news (executive hires, M&A, funding, expansion, technology investments, partnerships). Plain text summary only.`,
    maxTokens: 2000,
  });

  const assess = await completeJSON({
    system: CORE_RULES + JSON_ONLY_SUFFIX,
    prompt: `Assess this company as a Vee Technologies prospect based on the research below.

Company: ${company}${url ? ` (${url})` : ""}
Target vertical: ${vertical || "unspecified"}
ICP: $50M-$250M revenue, 201-1,500 employees, US-based, no large captive IT/offshore delivery

Research findings:
${search.text.slice(0, 3000)}

For "tier_rationale" and "qualification_rationale": be specific and concrete, grounded in the actual findings above - cite the specific fact, number, or event that drove the tier/qualification (e.g. "Tier 1: 2024 VP of Engineering hire from an offshore-heavy competitor, plus active postings for 6 senior engineering roles" not "Tier 1: strong fit for the vertical"). Generic boilerplate that could apply to any company in this vertical is not acceptable - if the findings don't support a specific claim, say what's actually missing instead of writing something vague.

For "flags": list every real reason for caution or disqualification you found, not just GCC/offshore delivery. Consider: company size outside the $50M-$250M revenue / 201-1,500 employee ICP range, vertical mismatch, recent acquisition that could mean the target no longer has standalone vendor decision authority, public company scale suggesting an existing large incumbent vendor relationship, weak or thin evidence behind the assigned tier, no genuinely relevant signal found in the research at all, or anything else that would make this a weak use of outreach time. Return an empty array only if you found nothing concerning - do not pad it, but do not default to GCC-only either.

Return JSON exactly matching this shape:
{"name":"${company}","hq":"City, ST or null","website":"${url || "null"}","vertical":"${vertical || "unspecified"}","signal_tier":"Tier 1 | Tier 2 | Tier 3","tier_rationale":"string","service_line_fit":"IT / Product Engineering | AEC / BIM Services | Siemens Building X | Data Center / MEP","why_now":"string","signal_verified":true,"gcc_risk":"low | medium | flag","gcc_note":"string","estimated_employees":"number or null","qualification":"Qualified | Flags Present | Disqualified","qualification_rationale":"string","flags":["string"]}`,
    maxTokens: 1500,
  });

  res.json({ ...assess.data, usage: { search: search.usage, assess: assess.usage } });
}));

// -- Step 2: company search (12 candidates) ----------------------------------
anthropicRouter.post("/company-search", handler(async (req, res) => {
  const { vertical, buyerType = "operator", sizeRange = "201-1,500 employees", tier1Only = false, signalTypes = [], excludeList = [], hqFilter = "" } = req.body || {};
  if (!vertical) return res.status(400).json({ error: "vertical is required" });

  const hqFocus = hqFilter.trim()
    ? `\nHEADQUARTERS LOCATION FILTER - only include companies you believe are headquartered in or near ${JSON.stringify(hqFilter.trim())}. This is a candidate-generation filter based on your general knowledge, not a verified fact - if you aren't reasonably confident a company is based there, leave it out rather than guessing.`
    : "";

  const signalFocus = signalTypes.length > 0
    ? `\nSIGNAL TYPE FOCUS - the user has selected the following specific patterns to search for. Every company should match at least one of these, and fit_rationale should reference which pattern applies and why, in honest general terms:\n${signalTypes.map((id) => {
        const st = SIGNAL_TYPES.find((s) => s.id === id);
        return st ? `- ${st.label}: ${st.instruction}` : "";
      }).join("\n")}`
    : "";

  const prompt = `${buyerType === "software"
    ? `Generate a candidate list of 12 real, named US-based SOFTWARE COMPANIES whose primary customer base is the ${JSON.stringify(vertical)} vertical. These are technology/SaaS vendors selling INTO the vertical, not operators in it. Examples: Procore (construction software), Trimble (AEC/surveying software), Viewpoint (construction ERP). These companies need engineering capacity to build and maintain their products - Vee IT/Product Engineering, BIM domain expertise, and AI-augmented development are all relevant entry points. Do not return general contractors, manufacturers, or other operators.`
    : `Generate a candidate list of 12 real, named US-based companies that plausibly fit Vee Technologies ICP for the ${JSON.stringify(vertical)} vertical.`} This is a starting list for further research, not a list of confirmed opportunities - do not invent specific facts about any individual company's current situation, headquarters address, or business activities.

What you actually know and can state: the company is real, operates in this vertical, and is roughly the right size category for mid-market B2B services. What you should NOT do: invent a specific headquarters city/state, invent a specific recent event or business reason tied to that company, or assign a confidence tier as if you have verified evidence. If you are not confident a fact is accurate, omit it rather than guess.

TIER PRIORITY: tier here means "general fit confidence based on company profile" - Tier 1 means this is a strong, well-known fit for the vertical and size category. Tier 2/3 mean plausible but less certain fit. This is not a claim of verified signal - real signal verification happens separately once a company is selected.
${tier1Only ? "- Only include companies you would genuinely rate Tier 1 by this definition. Return fewer than 12 if needed rather than padding." : "- Order the array with your highest-confidence fits first."}
${signalFocus}${hqFocus}

Criteria:
- Target employee range: ${sizeRange} - use your general knowledge of the company's approximate size, and say so plainly if uncertain
- NOT on the GCC disqualified list
- service_line_fit should reflect what Vee offering would generally make sense for a company like this, not a claim about a confirmed need
${excludeList.length ? `\nDo NOT include any of these companies:\n${excludeList.map((n) => `- ${n}`).join("\n")}` : ""}

Return ONLY a JSON array with exactly this shape - no other text. Keep "fit_rationale" to one sentence describing why this company's profile fits the vertical/ICP in general terms, not a specific claim about their current situation.

For "tier_rationale": name the specific thing driving the tier assignment for THIS company, not a template sentence that could apply to any company in the list (e.g. "Tier 1: dominant, well-known vendor in this exact niche at clearly the right employee scale" or "Tier 2: plausible fit but this is a smaller/less-established player where the size match is a guess" - not "Tier 1: strong fit for the vertical").

For signal_notes: use the actual signal type id strings as keys (e.g. "ma_activity", "pe_owned", "modernization"). For each matched signal type, provide one specific verifiable fact supporting the match. If you cannot state a specific fact, write "General pattern match - verify with intelligence pull". Only include keys for signal types that actually matched this company.

For "flags": list every real reason for caution about this candidate, not just GCC/offshore delivery risk. Consider: known scale well above or below the ICP band, being a subsidiary/division of a larger parent that may not have autonomous vendor decisions, being so dominant/large-cap that an existing incumbent relationship is likely, or genuine uncertainty about whether this company still operates independently (recent acquisition, merger, rebrand). Base flags only on general knowledge you're actually confident in - do not fabricate a specific concern you don't have real basis for. Empty array if nothing applies:
[
  {
    "name": "company name",
    "hq": "City, ST if you are confident, otherwise null",
    "website": "https://the-company's-real-domain.com if you are confident of the exact domain, otherwise null - never guess or invent a domain",
    "fit_rationale": "one sentence on why this company profile generally fits - no fabricated specifics",
    "service_line_fit": "IT / Product Engineering | AEC / BIM Services | Siemens Building X | Data Center / MEP",
    "signal_tier": "Tier 1 | Tier 2 | Tier 3",
    "tier_rationale": "specific to this company - see instructions above",
    "matched_signal_types": ["array of signal type ids that genuinely apply, empty array if none"],
    "signal_notes": {"ma_activity": "example - acquired [company] in [year] or was acquired by [company]"},
    "gcc_risk": "low | medium | flag",
    "gcc_note": "brief note only if gcc_risk is medium or flag, otherwise empty string",
    "flags": ["array of caution reasons per instructions above, empty array if none"]
  }
]`;

  const { text, usage } = await complete({
    system: CORE_RULES + "\nReturn raw JSON array only. No markdown fences, no preamble. Start with [ and end with ].",
    prompt,
    maxTokens: 4500,
  });
  const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    return res.status(502).json({ error: "Company search parse failed", raw: text.slice(0, 500) });
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return res.status(502).json({ error: "Company search returned no candidates", raw: text.slice(0, 500) });
  }

  parsed = parsed.map((c) => ({
    ...c,
    why_now: c.fit_rationale || c.why_now || "General ICP fit - no verified signal yet, pull news intelligence to confirm",
    signal_verified: false,
  }));

  const tierRank = (t) => (t === "Tier 1" ? 0 : t === "Tier 2" ? 1 : 2);
  parsed.sort((a, b) => tierRank(a.signal_tier) - tierRank(b.signal_tier));

  if (tier1Only) {
    parsed = parsed.filter((c) => c.signal_tier === "Tier 1");
  }

  res.json({ companies: parsed, usage });
}));

// -- Step 2: news intelligence, two-step (search then structure) ------------
anthropicRouter.post("/news-intel", handler(async (req, res) => {
  const { name, website, domain, disambiguationUrl, vertical, service_line_fit } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });

  const anchorUrl = disambiguationUrl || website || (domain ? `https://${domain}` : "");
  const urlContext = anchorUrl ? `Company website: ${anchorUrl}` : "";
  const disambigNote = anchorUrl
    ? `CRITICAL: You are researching "${name}" specifically - the company at ${anchorUrl}. If search results return information about a DIFFERENT company with a similar name (e.g. searching "Encompass Services" and finding "Encompass Health"), you MUST state clearly that you found results for the wrong company and return nothing from those results. Only include information that is definitively about this specific company.`
    : `CRITICAL: You are researching "${name}" specifically. If search results return information about a different company with a similar or identical name, state clearly that you found results for the wrong company rather than returning incorrect data. Verify the company context before including any information.`;

  const search = await completeWithWebSearch({
    system: `You are a business intelligence researcher. ${disambigNote} Search for recent news and write a plain text summary of what you find. No JSON, no formatting - just clear prose covering what you found.`,
    prompt: `Find recent news about "${name}"${urlContext ? ` (${urlContext})` : ""} - leadership changes, M&A, expansions, technology investments, partnerships, construction projects, events. Also find their exact corporate headquarters city and state. ${anchorUrl ? `Only include results that are clearly about this specific company at ${anchorUrl}.` : ""} Write a plain text summary of everything you find.`,
    maxTokens: 2000,
  });

  if (!search.text || search.text.length < 50) {
    return res.json({
      company: name,
      signals: [],
      summary: `No recent news found for ${name}. Try checking their LinkedIn company page or website directly.`,
      fetched: new Date().toISOString().split("T")[0],
      usage: { search: search.usage },
    });
  }

  const structured = await completeJSON({
    system: CORE_RULES + "\nReturn only valid JSON - no markdown fences, no explanation, just the raw JSON object.",
    prompt: `Structure these research findings about "${name}" into a JSON intelligence brief for a B2B technology services sales rep at Vee Technologies (IT services, BIM/AEC, Building X smart facilities, Data Center MEP).

Company: ${name}${vertical ? ` | Vertical: ${vertical}` : ""}${service_line_fit ? ` | Prior service line fit guess: ${service_line_fit}` : ""}

Findings:
${search.text.slice(0, 3000)}

These findings are REAL web search results, not a general-knowledge guess - use them to give a grounded reassessment of this company's signal tier, not just a news summary. "tier_rationale" and "flags" must cite something specific from the findings above, not restate generic ICP criteria. If the findings don't actually support a confident tier, say so plainly in tier_rationale rather than defaulting to an optimistic guess.

Return exactly this structure:
{"company":"${name}","hq":"City, ST - only if the findings above actually state it, otherwise null. Never guess.","signals":[{"category":"Executive Hire|M&A|Technology|Partnership|Event|Expansion|Financial|Construction|Other","headline":"brief headline","detail":"1-2 sentences","date":"date or recent","prospecting_relevance":"Vee opening","signal_strength":"High|Medium|Low","contact_implication":"contact suggestion or null"}],"summary":"2-3 sentence read on momentum and Vee opportunity","signal_tier":"Tier 1 | Tier 2 | Tier 3","tier_rationale":"specific to a fact found above, or a plain statement that the findings don't support a confident tier","flags":["array of caution reasons grounded in the findings above - GCC/offshore delivery, size mismatch, acquisition/ownership changes, lack of real signal, etc. Empty array if genuinely none."]}`,
    maxTokens: 2000,
  });

  const data = structured.data;
  if (!data.signals) data.signals = [];
  if (!data.summary) data.summary = `Intelligence brief generated for ${name}.`;
  if (!data.flags) data.flags = [];
  data.fetched = new Date().toISOString().split("T")[0];
  res.json({ ...data, usage: { search: search.usage, structure: structured.usage } });
}));

// -- Step 3: key leadership lookup, two-step (search then structure) --------
// Best-effort public-info lookup, not an org chart diagram - see
// Step3.jsx's "Key Leadership" card. Every entry is grounded in the web
// search text below it, same provenance discipline as /news-intel.
anthropicRouter.post("/leadership-lookup", handler(async (req, res) => {
  const { name, website, domain, disambiguationUrl } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });

  const anchorUrl = disambiguationUrl || website || (domain ? `https://${domain}` : "");
  const urlContext = anchorUrl ? `Company website: ${anchorUrl}` : "";
  const disambigNote = anchorUrl
    ? `CRITICAL: You are researching "${name}" specifically - the company at ${anchorUrl}. If search results return a different company with a similar name, state that clearly and do not include their people.`
    : `CRITICAL: You are researching "${name}" specifically. If search results return a different company with a similar or identical name, state that clearly rather than returning the wrong people.`;

  const search = await completeWithWebSearch({
    system: `You are a business intelligence researcher. ${disambigNote} Search for this company's current key leadership - CEO, CTO/CIO, COO, VP Engineering, VP IT, VP Operations, Head of Facilities, or other titles relevant to technology/facilities/engineering decisions. Write a plain text summary of who you find and their titles, with any source context (e.g. "per LinkedIn", "per company press release"). No JSON, no formatting - just clear prose.`,
    prompt: `Find the current key leadership team at "${name}"${urlContext ? ` (${urlContext})` : ""}, focused on executives relevant to a B2B technology/IT services sale: CEO, CTO, CIO, COO, VP/Director of Engineering, VP/Director of IT, VP of Operations, Head of Facilities or similar. For each person, note their name, title, and anything findable about tenure or background. Write a plain text summary of everything you find.`,
    maxTokens: 1500,
  });

  if (!search.text || search.text.length < 40) {
    return res.json({
      company: name,
      leaders: [],
      note: `No public leadership information found for ${name}. Try checking their website's leadership/about page or LinkedIn directly.`,
      fetched: new Date().toISOString().split("T")[0],
      usage: { search: search.usage },
    });
  }

  const structured = await completeJSON({
    system: CORE_RULES + "\nReturn only valid JSON - no markdown fences, no explanation, just the raw JSON object.",
    prompt: `Structure these research findings about "${name}"'s leadership into JSON for a B2B sales rep at Vee Technologies.

Findings:
${search.text.slice(0, 2500)}

Only include people the findings above actually name - never invent a name or title to fill out the list. If the findings only support a partial picture, return fewer entries rather than guessing. This is best-effort public information (LinkedIn, press releases, company site), not a verified org chart.

Return exactly this structure:
{"company":"${name}","leaders":[{"name":"full name","title":"their title as found","relevance":"why this role matters for a Vee Technologies IT/engineering/facilities sale, 1 sentence","source_note":"brief note on where this came from, e.g. 'per LinkedIn' or 'per 2024 press release', or null if unclear"}],"note":"1-2 sentences on overall confidence/completeness of this picture, e.g. if it's a small subset or dated"}`,
    maxTokens: 1200,
  });

  const data = structured.data;
  if (!data.leaders) data.leaders = [];
  data.fetched = new Date().toISOString().split("T")[0];
  res.json({ ...data, usage: { search: search.usage, structure: structured.usage } });
}));

// -- Step 3: contact analysis + outreach generation --------------------------
anthropicRouter.post("/contact-analysis", handler(async (req, res) => {
  const { linkedInText, company } = req.body || {};
  if (!linkedInText?.trim()) return res.status(400).json({ error: "linkedInText is required" });
  if (!company?.name) return res.status(400).json({ error: "company is required" });

  const prompt = `Analyze this LinkedIn profile and generate outreach for a Vee Technologies opportunity.

Company: ${company.name} | Service line: ${company.service_line_fit} | Signal: ${company.why_now}

PROFILE:
${linkedInText.slice(0, 2000)}

HOW TO CONSTRUCT THE OPENING - follow this method exactly:

Step 1, internal reasoning only, do not write this into the message: cross-reference the signal (${company.why_now}) against this person's actual stated responsibilities in the profile. What operational tension or pressure point does that combination create? Think about what becomes the bottleneck when this signal lands on top of their existing scope - capacity, speed, specialized skill gaps, vendor dependency, etc.

Step 2: open the message with that tension as an observation, not with their bio. Reference the real public signal by name since citing it shows genuine research rather than a templated message. Then state plainly, in the next sentence, that this is the specific area Vee Technologies can help with. No preamble, no restating their title or company back to them, no flattery.

WORKED EXAMPLE of the difference:
BAD (restates what they already know): "As VP of Innovation and Technology at Modine, you are leading the company's expansion into Data Center thermal management."
GOOD (names the real signal, states the implied tension, gets to the point): "Modine's move into Data Center thermal management on top of existing HVAC and Auto platforms usually means software and product engineering bandwidth becomes the constraint before the engineering does. That gap is exactly where Vee's embedded teams plug in."

HARD CONSTRAINTS:
- Never state or imply a specific technology, tech stack, framework, or tool unless explicitly named in the profile text. Do not infer technical specifics from title or industry.
- Never restate their title, company, or role back to them as if it's new information.
- If you are not certain of a fact, leave it out. A general but accurate message beats a specific but fabricated one.
- Keep it short, direct, no filler, no corporate language.

Return JSON:
{"contact":{"name":"string","title":"string","seniority":"C-suite|VP|Director|Manager","is_economic_buyer":true,"offshore_exposure":false,"offshore_note":"string or null","pain_indicators":["string - only from explicit profile content, never invented"],"recommended_angle":"string","tone_calibration":"string","outreach_channel":"LinkedIn InMail|LinkedIn Connection|Email"},"outreach":{"inmail":{"subject":"string","body":"string - opens with the signal-driven tension, not their bio, then states the Vee fit plainly"},"connection_request":"275 chars max","email":{"subject":"string","body":"string"},"recommended_channel":"string","sequence":{"if_accept_no_response":"string","if_not_right_now":"string","if_wrong_contact":"string"}},"additional_opportunities":[{"service_line":"IT / Product Engineering | AEC / BIM Services | Siemens Building X | Data Center / MEP","rationale":"one sentence - why this service line could also apply to this company beyond the primary fit. Only include if genuinely plausible based on what the company does, not as a generic upsell. Leave array empty if no additional lines are credible.","entry_point":"which type of role or signal would trigger this line as an entry point"}]}`;

  const { data, usage } = await completeJSON({
    system: CORE_RULES + JSON_ONLY_SUFFIX,
    prompt,
    maxTokens: 2000,
  });
  if (!data?.contact) return res.status(502).json({ error: "Contact analysis parse failed" });
  res.json({ ...data, usage });
}));

// -- Dynamic boolean search strings (replaces the old static 4-per-service-line
// templates) - generated per company from its actual matched signals and
// service line fit, so the search terms reflect this specific opportunity
// rather than a generic template. -------------------------------------------
anthropicRouter.post("/boolean-strings", handler(async (req, res) => {
  const { company } = req.body || {};
  if (!company?.name) return res.status(400).json({ error: "company is required" });

  const signalContext = (company.matched_signal_types || [])
    .map((id) => SIGNAL_TYPES.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join(", ");

  const prompt = `Build LinkedIn Sales Navigator boolean search strings to find the right contacts at this specific company.

Company: ${company.name}${company.hq ? ` (${company.hq})` : ""}
Primary service line fit: ${company.service_line_fit || "IT / Product Engineering"}
Signal: ${company.why_now || "none"}
Matched signal patterns: ${signalContext || "none"}
Signal tier: ${company.signal_tier || "unknown"}

Generate 3-4 distinct search tracks, each targeting a different but relevant buyer persona at THIS company for the primary service line, informed by the specific signal above (e.g. if the signal is an executive hire, include a track aimed at that new leader's likely peers/reports; if it's M&A, include a track aimed at integration-facing roles). Each track needs a real LinkedIn title-based boolean string using OR between equivalent title variants, matching this style: ("CIO" OR "Chief Information Officer" OR "CTO" OR "Chief Technology Officer")

Return JSON only:
{"tracks":[{"label":"short track name","rationale":"one sentence on why this persona matters for this specific company/signal","seniority":"C-suite / VP / Director etc","boolean":"(\\"Title\\" OR \\"Title\\" OR ...)"}]}`;

  const { data, usage } = await completeJSON({
    system: CORE_RULES + JSON_ONLY_SUFFIX,
    prompt,
    maxTokens: 1200,
  });
  if (!data?.tracks?.length) return res.status(502).json({ error: "Boolean string generation parse failed" });
  res.json({ ...data, usage });
}));

// -- Step 4: outreach package generation / director-note revision -----------
anthropicRouter.post("/outreach", handler(async (req, res) => {
  const { company, contact, notes } = req.body || {};
  if (!company?.name || !contact?.name) return res.status(400).json({ error: "company and contact are required" });

  const prompt = `Generate a complete outreach package.

Company: ${company.name} (${company.hq || "location unknown"})
Signal: ${company.why_now}
Service line: ${company.service_line_fit}
Signal tier: ${company.signal_tier}
Contact: ${contact.name}, ${contact.title}
Seniority: ${contact.seniority}
Economic buyer: ${contact.is_economic_buyer}
Offshore exposure: ${contact.offshore_exposure}
Angle: ${contact.recommended_angle}
Tone: ${contact.tone_calibration}
Channel: ${contact.outreach_channel}${notes ? `\nDirector notes: ${notes}` : ""}

Apply ALL messaging rules. Return JSON: {"inmail":{"subject":"string","body":"string"},"connection_request":"275 chars max","email":{"subject":"string","body":"string"},"recommended_channel":"string","sequence":{"if_accept_no_response":"string","if_not_right_now":"string","if_wrong_contact":"string"}}`;

  const { data, usage } = await completeJSON({
    system: CORE_RULES + JSON_ONLY_SUFFIX,
    prompt,
    maxTokens: 2000,
  });
  if (!data?.inmail) return res.status(502).json({ error: "Outreach generation parse failed" });
  res.json({ ...data, usage });
}));

// -- Intelligence tab: coaching insight from logged activity patterns -------
anthropicRouter.post("/coaching", handler(async (req, res) => {
  const { summary } = req.body || {};
  if (!summary) return res.status(400).json({ error: "summary is required" });

  const prompt = `Analyze this BD activity data for a Vee Technologies sales rep and generate strategic coaching insights.

Data: ${JSON.stringify(summary)}

Return JSON: {"top_performing_vertical":"which vertical is converting best and why","underperforming_area":"what's not working and why","channel_insight":"which channel is generating the most engagement","signal_tier_insight":"are higher tiers actually converting better","recommended_focus":"where to concentrate effort in the next 2 weeks","pattern_warning":"any concerning pattern worth flagging","coaching_note":"one specific tactical recommendation to improve conversion"}`;

  const { data, usage } = await completeJSON({
    system: "You are a sales performance analyst. Return raw JSON only - no markdown fences, no preamble. Start with { and end with }.",
    prompt,
    maxTokens: 1500,
  });
  if (!data?.recommended_focus) return res.status(502).json({ error: "Coaching insight parse failed" });
  res.json({ ...data, usage });
}));
