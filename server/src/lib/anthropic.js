// Thin wrapper around @anthropic-ai/sdk carrying the lessons from
// vee-claude-code-handoff.md "API calls":
//   - every call must be checked for failure before parsing (the SDK throws
//     on non-2xx, so we catch and surface a clear message instead of a
//     generic "JSON parse failed" downstream)
//   - token limits: 1000 is never enough for anything meaningful here -
//     callers pass an explicit maxTokens per call site, this module does
//     not silently default to something too small
//   - web search counts against the same budget as regular messages, same
//     as the original artifact

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

let client = null;
function getClient() {
  if (!config.anthropicApiKey) {
    const err = new Error("ANTHROPIC_API_KEY is not configured on the server");
    err.status = 501;
    throw err;
  }
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

function textFromMessage(message) {
  return (message.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("")
    .trim();
}

function stripJSONFences(raw) {
  return raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
}

// Plain text/JSON completion, no web search.
export async function complete({ system, prompt, maxTokens }) {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return { text: textFromMessage(message), usage: message.usage };
}

// Completion with the web_search tool enabled - used for the two-step
// research pattern (search for real signals, then a separate call
// synthesizes them into structured JSON).
export async function completeWithWebSearch({ system, prompt, maxTokens }) {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });
  return { text: textFromMessage(message), usage: message.usage };
}

// Completion that must return JSON. Strips markdown fences defensively
// (the system prompt already asks for raw JSON, but models sometimes wrap
// it anyway) and throws a clear error - with the raw text attached - on a
// parse failure, rather than returning null and letting the caller guess
// why.
export async function completeJSON({ system, prompt, maxTokens }) {
  const { text, usage } = await complete({ system, prompt, maxTokens });
  const clean = stripJSONFences(text);
  try {
    return { data: JSON.parse(clean), usage, raw: text };
  } catch (parseErr) {
    const err = new Error(`Model did not return valid JSON: ${parseErr.message}`);
    err.raw = text;
    throw err;
  }
}

export { MODEL };
