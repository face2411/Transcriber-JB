// Tag store (vee_exclusions.json) - a single map of company name -> tag
// entry. Tagged companies are excluded from future Step 2 search results;
// this file is also what drives the Tagged Accounts tab.
//
// This module only owns the tag map itself. Mirroring tagged_reason /
// tagged_date onto the company's own record (so Tagged Accounts detail
// panels and exports can see it without a second lookup) is workflow
// logic, not storage logic - that orchestration lives in the companies
// route, which calls both this store and companyStore.

import path from "node:path";
import { config } from "../config.js";
import { readJSON, updateJSON } from "./jsonFile.js";

const exclusionsPath = path.join(config.dataDir, "exclusions.json");

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export async function getExclusions() {
  return readJSON(exclusionsPath, {});
}

export async function isExcluded(name) {
  const exclusions = await getExclusions();
  return Boolean(exclusions[name]);
}

// `meta` carries whatever context is known at tag time (vertical,
// signal_tier, service_line_fit, hq) - all optional, all nullable.
export async function tagCompany(name, reason, meta = {}) {
  if (!name) throw new Error("tagCompany requires a company name");
  if (!reason) throw new Error("tagCompany requires a reason");

  const entry = {
    reason,
    date: todayISO(),
    vertical: meta.vertical ?? null,
    signal_tier: meta.signal_tier ?? null,
    service_line_fit: meta.service_line_fit ?? null,
    hq: meta.hq ?? null,
  };

  return updateJSON(
    exclusionsPath,
    (existing) => ({ ...(existing || {}), [name]: entry }),
    {}
  ).then(() => entry);
}

export async function removeTag(name) {
  await updateJSON(
    exclusionsPath,
    (existing) => {
      const next = { ...(existing || {}) };
      delete next[name];
      return next;
    },
    {}
  );
}
