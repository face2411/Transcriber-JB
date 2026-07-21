// Shared between server and client. Ported directly from the original
// vee-platform.jsx artifact (see spec.md) so both sides agree on the same
// vocabulary - vertical names, tag reasons, signal type ids - without drift.
//
// CORE_RULES (the AI system prompt) is intentionally NOT here: only the
// server talks to Anthropic, so it lives in server/src/prompts/coreRules.js.

// -- Design tokens (dark theme) ------------------------------------------------
export const THEME = {
  orange: "#E87722",   // Vee orange - the one accent
  orangeDim: "#b85a12",
  bg: "#080808",
  surface1: "#0f0f0f",
  surface2: "#141414",
  surface3: "#1c1c1c",
  border: "#242424",
  textPrimary: "#e8e8e8",
  textSecondary: "#a3a3a3",
  textMuted: "#888888",
  green: "#4caf50",
  red: "#e05555",
  blue: "#4a90d9",
};

// -- Navigation -----------------------------------------------------------------
export const TABS = [
  { id: "workflow", label: "Workflow" },
  { id: "tagged", label: "Tagged Accounts" },
  { id: "intelligence", label: "Intelligence" },
];

export const STEPS = ["Vertical Focus", "Companies", "Contact", "Outreach", "Activity Log"];

// -- Vee Technologies service lines ---------------------------------------------
export const SERVICE_LINES = [
  "IT / Product Engineering",
  "AEC / BIM Services",
  "Siemens Building X",
  "Data Center / MEP",
];

// -- Verticals --------------------------------------------------------------------
export const ALL_VERTICALS = [
  "Manufacturing",
  "AEC / Construction",
  "Distribution / Logistics",
  "Financial Services",
  "Healthcare Adjacent",
  "Data Center / Hyperscale",
  "Property / Facilities Management",
  "Technology / SaaS",
  "Energy / Utilities",
  "Retail / CPG",
];

// Aligned to Apollo's actual organization_num_employees_ranges buckets - no
// overlap, matches what Apollo's database actually segments by.
export const SIZE_FILTERS = [
  { id: "any", label: "Any Size", range: "201-1,500 employees", apolloRanges: ["201,500", "501,1000", "1001,2000"] },
  { id: "small", label: "Small", range: "201-500 employees", apolloRanges: ["201,500"] },
  { id: "mid", label: "Mid", range: "501-1,000 employees", apolloRanges: ["501,1000"] },
  { id: "large", label: "Large", range: "1,001-1,500 employees", apolloRanges: ["1001,2000"] },
];

// -- Tag reasons ------------------------------------------------------------------
export const TAG_REASONS = [
  // Active status tags
  "Watchlist - come back to",
  "Currently Prospecting",
  "In HubSpot - being worked",
  // Assignment
  "Already working",
  "Currently a client",
  "Assigned to another rep",
  // Disqualification
  "Disqualified - GCC",
  "Disqualified - ICP fit",
  "Disqualified - wrong vertical",
  "Competitor conflict",
  "No response - archived",
];

// Tag color by category - helps visually distinguish active from disqualified.
export function tagColor(reason) {
  if (!reason) return "default";
  if (reason.startsWith("Watchlist") || reason.startsWith("Currently Prospecting") || reason.startsWith("In HubSpot")) return "blue";
  if (reason.startsWith("Disqualified") || reason === "Competitor conflict" || reason === "No response - archived") return "red";
  return "orange";
}

// -- Signal types (10 total, multi-select filters) -------------------------------
// Each has a short UI label plus a tight, specific instruction the model can
// actually act on - vague labels like "niche" alone produce vague, fabricated
// results.
export const SIGNAL_TYPES = [
  {
    id: "modernization",
    label: "Modernization Era",
    instruction: "Prioritize companies founded roughly early 1990s to early 2000s. Companies this age commonly carry legacy systems and technical debt, and are common candidates for digital transformation or modernization initiatives. Note this in fit_rationale as an age-based modernization pattern, not as a confirmed initiative unless you have real basis for it.",
  },
  {
    id: "niche",
    label: "Niche Player",
    instruction: "Prioritize companies that operate in a narrow, specialized market segment - either a niche industry vertical or a focused product/customer base too small to justify a large in-house engineering organization. Use your judgment on what counts as niche given the vertical context.",
  },
  {
    id: "regulated",
    label: "Regulated / Can't AI-Build",
    instruction: "Prioritize companies in domains where AI-assisted or no-code development is not viable due to compliance, security clearance, safety certification, or regulatory requirements - examples include defense, medical devices, industrial controls, aerospace, financial infrastructure. These companies still require real engineering capacity because they cannot shortcut development the way a typical SaaS company might.",
  },
  {
    id: "understaffed_it",
    label: "Understaffed IT",
    instruction: "Prioritize companies that are large enough to have substantial software and IT needs but appear to run a disproportionately small internal IT/engineering department for their size. This pattern is close to a textbook FTE-embedded-model fit. Only state this if you have a real basis for the size/staffing gap, not a guess.",
  },
  {
    id: "ai_adoption",
    label: "AI Adoption Signal",
    instruction: "Prioritize companies actively signaling AI adoption intent - recent AI-related job postings, public statements about AI initiatives, or visible interest in AI consulting or AI-augmented development. This maps to Vee's AI-augmented development capability as an entry point.",
  },
  {
    id: "pe_owned",
    label: "PE / Investor Owned",
    instruction: "Prioritize companies known to be owned by a private equity firm or under active institutional investor ownership. PE portfolio companies commonly face pressure to professionalize operations and scale IT capability quickly post-acquisition, often without the internal bandwidth to do it themselves. Only state ownership if you are confident it is accurate.",
  },
  {
    id: "ma_activity",
    label: "M&A Activity",
    instruction: "Prioritize companies that have recently been acquired, recently completed an acquisition of another company, or are otherwise known to be in active M&A motion. Companies in this position commonly need to integrate disparate systems, data, and engineering teams - a concrete technical need, not a vague one. Only state this if you have real basis for it.",
  },
  {
    id: "new_leadership",
    label: "New Leadership",
    instruction: "Prioritize companies where a new CTO, CIO, VP of Engineering, or equivalent technical leader has recently joined. New technical leaders commonly arrive with a mandate to evaluate vendors, modernize systems, or build out engineering capacity in their first 6-12 months. This is distinct from the general age-based Modernization Era pattern - this is about a specific recent leadership change.",
  },
  {
    id: "outgrowing_vendor",
    label: "Outgrowing Current Vendor",
    instruction: "Prioritize companies that have likely scaled past what a small development shop, freelancer network, or single contractor relationship can reasonably support - typically signaled by rapid headcount growth, expanding product scope, or entering new markets faster than a lean engineering setup could keep pace with.",
  },
  {
    id: "multi_site",
    label: "Multi-Site / Multi-Location",
    instruction: "Prioritize companies operating across multiple physical locations, facilities, or business units. Multi-site operations commonly run on fragmented or inconsistent systems across locations, creating a concrete need for standardization and centralized IT or BIM/facilities coordination depending on the relevant Vee service line.",
  },
];

// -- Data model enums (see spec.md "Data Models") --------------------------------
export const SIGNAL_TIERS = ["Tier 1", "Tier 2", "Tier 3"];
export const QUALIFICATIONS = ["Qualified", "Flags Present", "Disqualified"];
export const GCC_RISK_LEVELS = ["low", "medium", "flag"];
export const RESPONSE_TYPES = ["positive", "neutral", "negative"];
export const HUBSPOT_STATUSES = ["Ready to enter", "Entered being worked", "On hold", "Not entering"];
export const OUTREACH_CHANNELS = ["LinkedIn InMail", "LinkedIn Connection", "Email", "Phone", "Other"];
