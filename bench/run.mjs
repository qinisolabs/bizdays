// bizdays benchmark runner.
//
//   npm run build           # build the library first
//   node bench/run.mjs                 # scores the recorded baseline (bench/llm-answers.json)
//   node bench/run.mjs answers.json    # scores any answers file (array of 30 strings)
//
// Always runs the "bizdays" arm (the built library) against the independent ground
// truth from generate.mjs and asserts it is 100% correct. Then scores an LLM's
// tool-free answers (a JSON array, one answer per question, in order).

import { readFileSync } from "node:fs";
import { generate } from "./generate.mjs";
import { addBusinessDays, countBusinessDays, isBusinessDay } from "../dist/index.js";

const items = generate();
const cc = (q) => q.slice(3, 5);

function bizdaysAnswer(it) {
  if (it.category === "add") {
    const r = it.question.match(/is (-?\d+) business day\(s\) after (\d{4}-\d{2}-\d{2})/);
    return addBusinessDays(r[2], Number(r[1]), cc(it.question)).result;
  }
  if (it.category === "count") {
    const r = it.question.match(/from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
    return String(countBusinessDays(r[1], r[2], cc(it.question)).businessDays);
  }
  const d = it.question.match(/is (\d{4}-\d{2}-\d{2})/)[1];
  return isBusinessDay(d, cc(it.question)).isBusinessDay ? "yes" : "no";
}

// ---- bizdays arm ----
let libOK = 0;
for (const it of items) if (bizdaysAnswer(it) === it.answer) libOK++;
console.log(`bizdays library:  ${libOK}/${items.length} (${Math.round((100 * libOK) / items.length)}%)`);
if (libOK !== items.length) {
  console.error("bizdays does not match ground truth — aborting.");
  process.exit(1);
}

// ---- LLM arm ----
const file = process.argv[2] || new URL("./llm-answers.json", import.meta.url).pathname;
let llm;
try {
  llm = JSON.parse(readFileSync(file, "utf8"));
} catch {
  console.log(`\nNo answers file at ${file}. Pass one to score an LLM run.`);
  process.exit(0);
}

const byCat = {};
let llmOK = 0;
const misses = [];
items.forEach((it, i) => {
  byCat[it.category] ??= [0, 0];
  byCat[it.category][1]++;
  const got = String(llm[i] ?? "").trim().toLowerCase();
  if (got === it.answer.toLowerCase()) {
    llmOK++;
    byCat[it.category][0]++;
  } else {
    misses.push(`#${it.id} [${it.category}] ${cc(it.question)}: got "${llm[i]}" expected "${it.answer}"`);
  }
});

const err = Math.round((100 * (items.length - llmOK)) / items.length);
console.log(`unaided LLM:      ${llmOK}/${items.length} correct (${err}% error)\n`);
for (const k of Object.keys(byCat)) {
  const [ok, n] = byCat[k];
  console.log(`  ${k.padEnd(6)} ${ok}/${n} correct (${Math.round((100 * (n - ok)) / n)}% error)`);
}
if (misses.length) {
  console.log("\nMisses:");
  misses.forEach((m) => console.log("  " + m));
}
