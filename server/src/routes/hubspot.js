// HubSpot stub endpoints - intentionally not implemented (see
// vee-platform-spec.md "Future Integrations (stub endpoints in rebuild)").
// HubSpot is the system of record for pipeline; this tool feeds it, it
// does not replace it. These routes exist so the client has a stable URL
// shape to build the Step 5 "HubSpot Handoff" UI against once real
// integration work starts, and so hitting them fails with a clear message
// instead of a generic 404.
//
// Planned mapping when implemented:
//   POST /api/hubspot/companies  <- Company Record
//   POST /api/hubspot/contacts   <- contact analysis output
//   POST /api/hubspot/notes      <- session brief
//   POST /api/hubspot/activities <- activity log entry

import { Router } from "express";

export const hubspotRouter = Router();

function notImplemented(req, res) {
  res.status(501).json({
    error: "HubSpot integration is not implemented yet - see spec.md 'Future Integrations'",
    path: req.originalUrl,
  });
}

hubspotRouter.post("/companies", notImplemented);
hubspotRouter.post("/contacts", notImplemented);
hubspotRouter.post("/notes", notImplemented);
hubspotRouter.post("/activities", notImplemented);
