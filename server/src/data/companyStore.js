// Company Intelligence Store - one JSON file per company, plus an index.
//
// Design decisions carried over from spec.md "Company Intelligence Store":
//   - One file per company: vee_co_{safename}.json
//   - An index tracks all company keys (kept here with a little denormalized
//     metadata - name/vertical/tier/qualification/tagged_reason/last_updated -
//     so the Tagged Accounts list and "Intel cached" badges don't have to
//     read every company file just to render a list).
//   - Saves merge data. They never overwrite an existing field with null,
//     so a partial write (e.g. a tag action that only knows vertical/tier)
//     can't blow away a fuller record saved earlier by Fast Mode or a news
//     intel pull.
//   - Never re-fetched by callers unless a Refresh is explicitly requested -
//     that policy lives in the route/workflow layer, not here; this module
//     only knows how to load and save.

import path from "node:path";
import { config } from "../config.js";
import { readJSON, updateJSON } from "./jsonFile.js";

const companiesDir = path.join(config.dataDir, "companies");
const indexPath = path.join(config.dataDir, "company_index.json");

// Same key derivation as the original artifact's coKey(): strip to
// alphanumerics and cap length, so filenames stay filesystem-safe and
// stable across repeat lookups of the same company name.
export function companyKey(name) {
  return "vee_co_" + String(name || "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
}

function recordPath(key) {
  return path.join(companiesDir, `${key}.json`);
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Shallow-merges `incoming` onto `existing`, skipping any incoming field
// that is null or undefined so it can't erase data a previous save wrote.
// To intentionally clear a field, callers must not include it as null -
// there is deliberately no "clear this field" path yet.
function mergeRecord(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined) continue;
    merged[key] = value;
  }
  return merged;
}

function indexEntry(record) {
  return {
    name: record.name,
    vertical: record.vertical ?? null,
    signal_tier: record.signal_tier ?? null,
    qualification: record.qualification ?? null,
    service_line_fit: record.service_line_fit ?? null,
    hq: record.hq ?? null,
    tagged_reason: record.tagged_reason ?? null,
    tagged_date: record.tagged_date ?? null,
    has_news: Boolean(record.news),
    last_updated: record.last_updated,
  };
}

export async function saveCompanyRecord(name, data) {
  if (!name) throw new Error("saveCompanyRecord requires a company name");
  const key = companyKey(name);
  const record = await updateJSON(
    recordPath(key),
    (existing) => mergeRecord(existing || {}, { ...data, name, last_updated: todayISO() }),
    {}
  );

  await updateJSON(
    indexPath,
    (idx) => ({ ...(idx || {}), [key]: indexEntry(record) }),
    {}
  );

  return record;
}

export async function loadCompanyRecord(name) {
  return readJSON(recordPath(companyKey(name)), null);
}

export async function loadCompanyRecordByKey(key) {
  return readJSON(recordPath(key), null);
}

export async function listCompanyIndex() {
  const idx = await readJSON(indexPath, {});
  return Object.entries(idx).map(([key, entry]) => ({ key, ...entry }));
}
