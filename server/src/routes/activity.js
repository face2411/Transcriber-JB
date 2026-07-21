import { Router } from "express";
import { listActivity, appendActivity, updateActivity } from "../data/index.js";

export const activityRouter = Router();

activityRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listActivity());
  } catch (err) {
    next(err);
  }
});

activityRouter.post("/", async (req, res, next) => {
  try {
    const entry = await appendActivity(req.body || {});
    res.status(201).json(entry);
  } catch (err) {
    if (err.message.startsWith("appendActivity requires")) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Response tracking is "optional at log time, updatable later" per
// spec.md Step 5 - this is how the Intelligence tab's "Log Response" /
// "Update" action persists.
activityRouter.patch("/:id", async (req, res, next) => {
  try {
    const updated = await updateActivity(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    if (err.message.startsWith("Activity log entry not found")) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});
