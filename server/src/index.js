import open from "open";
import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

app.listen(config.port, () => {
  const url = `http://localhost:${config.port}`;
  console.log(`Vee platform server listening at ${url}`);
  console.log(`Data directory: ${config.dataDir}`);
  if (process.env.NO_OPEN !== "1") {
    open(url).catch(() => {
      // Headless/CI environments have no browser to open - not fatal.
    });
  }
});
