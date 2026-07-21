import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // server/

export const config = {
  port: Number(process.env.PORT) || 4000,
  dataDir: path.resolve(serverRoot, process.env.DATA_DIR || "./data"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  hubspotApiKey: process.env.HUBSPOT_API_KEY || null,
  apolloApiKey: process.env.APOLLO_API_KEY || null,
  hunterApiKey: process.env.HUNTER_API_KEY || null,
};
