import { test } from "node:test";
import assert from "node:assert/strict";
import { mapFilesToFlows, matchesGlob } from "./impact-mapper.ts";
import { blastRadius } from "./runner.ts";
import type { VerifyConfig } from "./contracts.ts";

const FLOW_MAP = {
  "apps/web/src/views/ShortStudio.tsx": ["landing", "wizard", "validation"],
  "apps/web/src/views/RenderLibrary.tsx": ["gallery"],
  "apps/web/src/Router.tsx": ["landing", "gallery"],
  "apps/server/**": ["api_health"],
};

const config = {
  ignore: ["packages/pipeline/**", "packages/orchestrator/**", "packages/core/**", "docs/**", "qa-specs/**", ".postready-qa/**"],
  fallbackFlow: "landing",
  flows: { landing: {}, wizard: {}, validation: {}, gallery: {}, api_health: {} },
} as unknown as VerifyConfig;

test("globs match the paths they claim", () => {
  assert.ok(matchesGlob("apps/server/src/index.ts", "apps/server/**"));
  assert.ok(matchesGlob("apps/web/src/views/ShortStudio.tsx", "apps/web/src/views/ShortStudio.tsx"));
  assert.ok(!matchesGlob("apps/web/src/pages/Home.test.tsx", "apps/web/src/views/ShortStudio.tsx"));
});

test("ShortStudio.tsx drags landing, wizard, and validation", () => {
  const { flows, unmapped } = mapFilesToFlows(["apps/web/src/views/ShortStudio.tsx"], FLOW_MAP);
  assert.deepEqual(flows, ["landing", "validation", "wizard"]);
  assert.deepEqual(unmapped, []);
});

test("Lane 3 author-path edits do not start a browser", () => {
  const radius = blastRadius(config, FLOW_MAP, [
    "packages/pipeline/src/browser-agent.ts",
    "packages/orchestrator/src/workflow.ts",
    "docs/README.md",
  ]);
  assert.deepEqual(radius.flows, []);
  assert.deepEqual(radius.changed, []);
});

test("an unmapped studio file still forces the landing fallback", () => {
  const radius = blastRadius(config, FLOW_MAP, ["apps/web/src/views/NewSurface.tsx"]);
  assert.deepEqual(radius.unmapped, ["apps/web/src/views/NewSurface.tsx"]);
  assert.deepEqual(radius.flows, ["landing"]);
});
