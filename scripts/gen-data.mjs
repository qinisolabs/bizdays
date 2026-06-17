// Generates src/data.generated.ts from the curated data/*.json files.
// Run via `npm run gen` (chained into build/test) and by wrangler before bundling.
// Keeping data/*.json as the source of truth but emitting a TS module means the
// runtime never touches node:fs — so the same code bundles in a Cloudflare Worker.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const overrides = JSON.parse(readFileSync(join(root, "data/weekend-overrides.json"), "utf8"));
const tier1 = JSON.parse(readFileSync(join(root, "data/tier1-countries.json"), "utf8"));

const out = `// AUTO-GENERATED from data/*.json by scripts/gen-data.mjs — do not edit by hand.
export interface WeekendOverride {
  weekend: number[];
  cldr: number[];
  reason: string;
  source: string;
}

export const WEEKEND_OVERRIDES: Record<string, WeekendOverride> = ${JSON.stringify(overrides.overrides, null, 2)};

export const TIER1: string[] = ${JSON.stringify(tier1.tier1)};
`;

writeFileSync(join(root, "src/data.generated.ts"), out);
console.error("generated src/data.generated.ts");
