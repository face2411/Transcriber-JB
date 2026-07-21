import { Router } from "express";
import { listCompanyIndex, loadCompanyRecordByKey, loadCompanyRecord, saveCompanyRecord } from "../data/index.js";

export const companiesRouter = Router();

// Index listing - powers the Tagged Accounts list and "Intel cached"
// badges without reading every company file.
companiesRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listCompanyIndex());
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/by-name/:name", async (req, res, next) => {
  try {
    const record = await loadCompanyRecord(req.params.name);
    if (!record) return res.status(404).json({ error: "Company not found" });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:key", async (req, res, next) => {
  try {
    const record = await loadCompanyRecordByKey(req.params.key);
    if (!record) return res.status(404).json({ error: "Company not found" });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

// Save/merge - used by Fast Mode completion, news intel pulls, and Step 5
// outreach logging (see spec.md "Company Intelligence Store"). Never
// overwrites existing fields with null; see companyStore.mergeRecord.
companiesRouter.put("/:name", async (req, res, next) => {
  try {
    const record = await saveCompanyRecord(req.params.name, req.body || {});
    res.json(record);
  } catch (err) {
    next(err);
  }
});
