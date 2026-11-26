#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const target = join(root, "apps", "web", "src", "views", "ShortStudio.tsx");
const src = readFileSync(target, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";

const broken = `            <button type="submit" className="btn-ink-pill">${eol}              Continue`;
const fixed = `            <button type="button" className="btn-ink-pill" onClick={next}>${eol}              Continue`;

if (src.includes(fixed)) {
  process.stdout.write("verify:restore: ShortStudio.tsx already has onClick={next}\n");
  process.exit(0);
}
if (!src.includes(broken)) {
  process.stderr.write("verify:restore: broken Continue button not found in ShortStudio.tsx\n");
  process.exit(1);
}
writeFileSync(target, src.replace(broken, fixed), "utf8");
process.stdout.write("verify:restore applied — restored Continue button in ShortStudio.tsx\n");
