// Activity log (vee_activity_log.json) - append-only list of outreach log
// entries, with response tracking fields updatable after the fact (see
// spec.md Step 5 "Response tracking ... optional at log time, updatable
// later"). Backs the Intelligence tab's summary strip, pattern charts, and
// recent-outreach list.

import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { readJSON, updateJSON } from "./jsonFile.js";

const activityLogPath = path.join(config.dataDir, "activity_log.json");

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export async function listActivity() {
  return readJSON(activityLogPath, []);
}

export async function appendActivity(entry) {
  const record = {
    id: randomUUID(),
    date: entry.date || todayISO(),
    company: entry.company,
    contact: entry.contact ?? null,
    title: entry.title ?? null,
    channel: entry.channel,
    vertical: entry.vertical ?? null,
    signal_tier: entry.signal_tier ?? null,
    service_line_fit: entry.service_line_fit ?? null,
    hubspot_status: entry.hubspot_status ?? null,
    notes: entry.notes ?? null,
    response_received: entry.response_received ?? null,
    response_type: entry.response_type ?? null,
    led_to_meeting: entry.led_to_meeting ?? null,
  };
  if (!record.company) throw new Error("appendActivity requires a company");
  if (!record.channel) throw new Error("appendActivity requires a channel");

  await updateJSON(activityLogPath, (existing) => [...(existing || []), record], []);
  return record;
}

export async function updateActivity(id, patch) {
  let updated = null;
  await updateJSON(
    activityLogPath,
    (existing) => {
      const list = existing || [];
      const idx = list.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error(`Activity log entry not found: ${id}`);
      updated = { ...list[idx], ...patch, id: list[idx].id };
      const next = [...list];
      next[idx] = updated;
      return next;
    },
    []
  );
  return updated;
}
