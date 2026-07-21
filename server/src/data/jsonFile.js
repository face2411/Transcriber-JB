// Low-level JSON file persistence: atomic writes plus a per-file mutex.
//
// The whole reason for this rebuild is that window.storage (the previous
// persistence layer) was unreliable. Two failure modes get fixed here:
//   1. A write that dies partway through (crash, ENOSPC) must never leave a
//      truncated/corrupt file - write to a temp file and rename over the
//      original, which is atomic on the same filesystem.
//   2. Two requests touching the same file concurrently (e.g. two tags
//      landing on the same company within the same tick) must not race and
//      silently drop one of them - each file path gets a FIFO queue so
//      read-modify-write cycles against it never interleave.

import fs from "node:fs/promises";
import path from "node:path";

const locks = new Map(); // absolute file path -> tail of the queue (a Promise)

// Runs `fn` with exclusive access to `filePath`, queued behind any
// in-flight operation on that same path. Concurrent calls for different
// paths run independently.
function withFileLock(filePath, fn) {
  const key = path.resolve(filePath);
  const previous = locks.get(key) || Promise.resolve();
  const run = previous.then(fn, fn); // run fn regardless of whether the previous op threw
  // Keep the chain alive but don't let a rejection here propagate into the map.
  locks.set(key, run.catch(() => {}));
  return run;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

// Reads and parses a JSON file. Returns `fallback` if the file does not
// exist yet. A file that exists but fails to parse is a real corruption
// problem, not an empty-store case, so it throws instead of masquerading
// as "no data".
export async function readJSON(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      throw new Error(`Corrupt JSON in ${filePath}: ${parseErr.message}`);
    }
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJSONUnlocked(filePath, data) {
  await ensureDir(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmpPath, filePath); // atomic on the same filesystem
}

export function writeJSON(filePath, data) {
  return withFileLock(filePath, () => writeJSONUnlocked(filePath, data));
}

// Read-modify-write under the same lock as writeJSON, so a concurrent plain
// writeJSON() (or another updateJSON()) on this path can't interleave with
// the read and clobber the result. `updater` receives the current value
// (or `fallback` if the file doesn't exist yet) and returns the new value.
export function updateJSON(filePath, updater, fallback = null) {
  return withFileLock(filePath, async () => {
    // readJSON throws on corruption rather than masquerading as `fallback` -
    // let that propagate instead of writing new data on top of a bad file.
    const current = await readJSON(filePath, fallback);
    const next = await updater(current);
    await writeJSONUnlocked(filePath, next);
    return next;
  });
}
