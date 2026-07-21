import { Router } from "express";
import { getExclusions, tagCompany, removeTag, saveCompanyRecord } from "../data/index.js";
import { TAG_REASONS } from "@vee/shared";

export const exclusionsRouter = Router();

exclusionsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await getExclusions());
  } catch (err) {
    next(err);
  }
});

// Tagging a company both records the tag (this drives search exclusion and
// the Tagged Accounts tab) and mirrors the tag onto the company's own
// record, since tagged_reason/tagged_date are fields on the Company Record
// itself per spec.md's data model - callers reading a company record
// shouldn't have to cross-reference the exclusions map to see why it was
// tagged.
exclusionsRouter.post("/:name", async (req, res, next) => {
  try {
    const { reason, vertical, signal_tier, service_line_fit, hq } = req.body || {};
    if (!TAG_REASONS.includes(reason)) {
      return res.status(400).json({ error: `Invalid tag reason. Must be one of: ${TAG_REASONS.join(", ")}` });
    }
    const entry = await tagCompany(req.params.name, reason, { vertical, signal_tier, service_line_fit, hq });
    await saveCompanyRecord(req.params.name, {
      vertical, signal_tier, service_line_fit, hq,
      tagged_reason: entry.reason,
      tagged_date: entry.date,
    });
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

exclusionsRouter.delete("/:name", async (req, res, next) => {
  try {
    await removeTag(req.params.name);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
