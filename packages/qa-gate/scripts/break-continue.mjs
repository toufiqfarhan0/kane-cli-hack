#!/usr/bin/env node
/**
 * Safe Continue-submit mutation test: switches type="button" to type="submit" without onClick={next}.
 * Form onSubmit stays preventDefault-only so Kane cannot fire a job creation POST.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const target = join(root, "apps", "web", "src", "views", "ShortStudio.tsx");
const src = readFileSync(target, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";

const from = `            <button type="button" className="btn-ink-pill" onClick={next}>${eol}              Continue`;
const to = `            <button type="submit" className="btn-ink-pill">${eol}              Continue`;

if (src.includes(to) && !src.includes(from)) {
  process.stdout.write("verify:plant already applied\n");
  process.exit(0);
}
if (!src.includes(from)) {
  process.stderr.write("verify:plant: expected Continue button not found in ShortStudio.tsx\n");
  process.exit(1);
}
writeFileSync(target, src.replace(from, to), "utf8");
process.stdout.write("verify:plant applied — Continue is type=submit with no onClick={next}\n");
process.stdout.write("Run npm run verify:restore when finished.\n");
