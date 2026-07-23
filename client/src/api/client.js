// All calls to the local Express server. Every function here throws a
// real Error with the server's message on a non-2xx response instead of
// letting callers try to read fields off a failed response - this is the
// res.ok check the original artifact was missing on its direct
// api.anthropic.com calls (see vee-claude-code-handoff.md "API calls").

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // No JSON body (e.g. a 204) - fine, leave data null.
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status} ${res.statusText}`);
  }
  return data;
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body ?? {}) });
const put = (path, body) => request(path, { method: "PUT", body: JSON.stringify(body ?? {}) });
const patch = (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
const del = (path) => request(path, { method: "DELETE" });

export const health = () => get("/api/health");

// -- Company Intelligence Store ----------------------------------------------
export const listCompanyIndex = () => get("/api/companies");
export const getCompanyByName = (name) => get(`/api/companies/by-name/${encodeURIComponent(name)}`);
export const getCompanyByKey = (key) => get(`/api/companies/${encodeURIComponent(key)}`);
export const saveCompany = (name, data) => put(`/api/companies/${encodeURIComponent(name)}`, data);

// -- Tags / exclusions ---------------------------------------------------------
export const getExclusions = () => get("/api/exclusions");
export const tagCompany = (name, body) => post(`/api/exclusions/${encodeURIComponent(name)}`, body);
export const removeTag = (name) => del(`/api/exclusions/${encodeURIComponent(name)}`);

// -- Activity log ---------------------------------------------------------------
export const listActivity = () => get("/api/activity");
export const logActivity = (entry) => post("/api/activity", entry);
export const updateActivityEntry = (id, patch_) => patch(`/api/activity/${encodeURIComponent(id)}`, patch_);

// -- Anthropic-backed BD intelligence --------------------------------------------
export const anthropic = {
  verticalRecommendation: () => post("/api/anthropic/vertical-recommendation"),
  fastResearch: (body) => post("/api/anthropic/fast-research", body),
  companySearch: (body) => post("/api/anthropic/company-search", body),
  newsIntel: (body) => post("/api/anthropic/news-intel", body),
  leadershipLookup: (body) => post("/api/anthropic/leadership-lookup", body),
  contactAnalysis: (body) => post("/api/anthropic/contact-analysis", body),
  booleanStrings: (body) => post("/api/anthropic/boolean-strings", body),
  outreach: (body) => post("/api/anthropic/outreach", body),
  coaching: (body) => post("/api/anthropic/coaching", body),
};

// -- Apollo (server-side, fixes CORS) --------------------------------------------
export const apollo = {
  organizationSearch: (body) => post("/api/apollo/organization-search", body),
  peopleMatch: (body) => post("/api/apollo/people-match", body),
};

// -- Hunter.io (server-side, fixes CORS) -----------------------------------------
export const hunter = {
  emailFinder: (body) => post("/api/hunter/email-finder", body),
};
