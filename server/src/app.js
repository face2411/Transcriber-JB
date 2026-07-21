import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { companiesRouter } from "./routes/companies.js";
import { exclusionsRouter } from "./routes/exclusions.js";
import { activityRouter } from "./routes/activity.js";
import { anthropicRouter, hubspotRouter, apolloRouter, hunterRouter } from "./routes/stubs.js";

const serverSrcDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(serverSrcDir, "../../client/dist");

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.use("/api/companies", companiesRouter);
  app.use("/api/exclusions", exclusionsRouter);
  app.use("/api/activity", activityRouter);

  // Stub endpoints for future integrations (spec.md "Future Integrations").
  app.use("/api/anthropic", anthropicRouter);
  app.use("/api/hubspot", hubspotRouter);
  app.use("/api/apollo", apolloRouter);
  app.use("/api/hunter", hunterRouter);

  // In dev, the client runs on its own Vite server and proxies /api here.
  // In production (`npm start`), this process serves the built client too.
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  return app;
}
