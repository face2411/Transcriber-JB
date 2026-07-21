// Placeholder endpoints for integrations the spec calls out as future work
// (spec.md "Future Integrations" and the Anthropic-backed workflow calls in
// "API Calls"). Kept as real, mounted routes now - rather than left
// unmounted - so the client can be built against a stable URL shape before
// the actual implementations land, and so hitting them fails loudly with a
// clear message instead of a generic 404.

import { Router } from "express";

function notImplemented(name) {
  return (req, res) => {
    res.status(501).json({ error: `${name} is not implemented yet`, path: req.originalUrl });
  };
}

export const anthropicRouter = Router();
anthropicRouter.all("*", notImplemented("Anthropic API integration"));

export const hubspotRouter = Router();
hubspotRouter.all("*", notImplemented("HubSpot API integration"));

export const apolloRouter = Router();
apolloRouter.all("*", notImplemented("Apollo.io API integration"));

export const hunterRouter = Router();
hunterRouter.all("*", notImplemented("Hunter.io API integration"));
