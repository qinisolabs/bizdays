import assert from "node:assert/strict";
import {
  isBusinessDay,
  addBusinessDays,
  countBusinessDays,
  nextBusinessDay,
  previousBusinessDay,
  countryRule,
  weekendInfo,
  publicHolidayOn,
} from "../src/index.js";
import { handleRpc } from "../src/core.js";

let pass = 0;
let fail = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    pass++;
  } catch (err) {
    fail++;
    console.error(`✗ ${name}\n    ${(err as Error).message}`);
  }
}

/* ---------- weekend rules (the moat) ---------- */
check("US weekend = Sat/Sun", () => assert.deepEqual(weekendInfo("US").weekend, [6, 7]));
check("Saudi weekend = Fri/Sat", () => assert.deepEqual(weekendInfo("SA").weekend, [5, 6]));
check("UAE weekend = Sat/Sun (post-2022)", () => assert.deepEqual(weekendInfo("AE").weekend, [6, 7]));
check("Egypt weekend = Fri/Sat", () => assert.deepEqual(weekendInfo("EG").weekend, [5, 6]));
check("Israel weekend = Fri/Sat", () => assert.deepEqual(weekendInfo("IL").weekend, [5, 6]));
check("Iran weekend = Fri only", () => assert.deepEqual(weekendInfo("IR").weekend, [5]));
check("India weekend = Sun only", () => assert.deepEqual(weekendInfo("IN").weekend, [7]));
check("Qatar weekend = Fri/Sat (CLDR)", () => assert.deepEqual(weekendInfo("QA").weekend, [5, 6]));
// Curated overrides correcting CLDR:
check("Bangladesh override = Fri/Sat", () => {
  const w = weekendInfo("BD");
  assert.deepEqual(w.weekend, [5, 6]);
  assert.equal(w.source, "override");
});
check("Nepal override = Sat only", () => {
  const w = weekendInfo("NP");
  assert.deepEqual(w.weekend, [6]);
  assert.equal(w.source, "override");
});
check("GB weekend source = cldr", () => assert.equal(weekendInfo("GB").source, "cldr"));

/* ---------- is_business_day ---------- */
check("2025-12-25 is NOT a business day in US (Christmas)", () =>
  assert.equal(isBusinessDay("2025-12-25", "US").isBusinessDay, false));
check("2025-12-25 reason = public-holiday", () =>
  assert.equal(isBusinessDay("2025-12-25", "US").reason, "public-holiday"));
check("2025-12-26 is NOT a business day in GB (Boxing Day)", () =>
  assert.equal(isBusinessDay("2025-12-26", "GB").isBusinessDay, false));
check("Sat 2025-06-14 is NOT a business day in US", () =>
  assert.equal(isBusinessDay("2025-06-14", "US").reason, "weekend"));
check("Fri 2025-06-13 IS a business day in UAE (weekend=Sat/Sun)", () =>
  assert.equal(isBusinessDay("2025-06-13", "AE").isBusinessDay, true));
check("Fri 2025-06-13 is NOT a business day in Saudi (weekend=Fri/Sat)", () =>
  assert.equal(isBusinessDay("2025-06-13", "SA").isBusinessDay, false));
check("Sun 2025-06-15 is NOT a business day in UAE (Sunday is weekend)", () =>
  assert.equal(isBusinessDay("2025-06-15", "AE").isBusinessDay, false));
check("ordinary Tue 2025-06-17 is a business day in US", () =>
  assert.equal(isBusinessDay("2025-06-17", "US").isBusinessDay, true));
check("custom holiday is honored", () =>
  assert.equal(isBusinessDay("2025-06-17", "US", ["2025-06-17"]).reason, "custom-holiday"));

/* ---------- observances must NOT count (core correctness) ---------- */
check("Valentine's Day 2025 IS a business day in US (observance, not public)", () =>
  assert.equal(isBusinessDay("2025-02-14", "US").isBusinessDay, true));
check("Christmas Eve 2025 IS a business day in US (optional, not public)", () =>
  assert.equal(isBusinessDay("2025-12-24", "US").isBusinessDay, true));
check("publicHolidayOn returns null for Valentine's Day US", () =>
  assert.equal(publicHolidayOn("2025-02-14", "US"), null));
check("publicHolidayOn returns Christmas for 2025-12-25 US", () =>
  assert.equal(publicHolidayOn("2025-12-25", "US")?.name?.toLowerCase().includes("christmas"), true));

/* ---------- add_business_days ---------- */
check("1 biz day after Fri 2025-06-13 in US = Mon 2025-06-16", () =>
  assert.equal(addBusinessDays("2025-06-13", 1, "US").result, "2025-06-16"));
check("add skips Christmas: 1 biz day after Wed 2025-12-24 US = Fri 2025-12-26", () =>
  assert.equal(addBusinessDays("2025-12-24", 1, "US").result, "2025-12-26"));
check("add records skipped holiday name", () => {
  const r = addBusinessDays("2025-12-24", 1, "US");
  assert.equal(r.skippedHolidays.some((h) => h.name.toLowerCase().includes("christmas")), true);
});
check("negative add = previous business day", () =>
  assert.equal(addBusinessDays("2025-06-16", -1, "US").result, "2025-06-13"));
check("result is always a business day", () =>
  assert.equal(isBusinessDay(addBusinessDays("2025-12-23", 5, "US").result, "US").isBusinessDay, true));
check("0 days returns the start date unchanged", () =>
  assert.equal(addBusinessDays("2025-06-17", 0, "US").result, "2025-06-17"));
check("UAE add respects Sat/Sun weekend: 1 biz day after Thu 2025-06-12 = Fri 2025-06-13", () =>
  assert.equal(addBusinessDays("2025-06-12", 1, "AE").result, "2025-06-13"));

/* ---------- next / previous ---------- */
check("next business day after Christmas-eve-week Fri 2025-12-26 US = Mon 2025-12-29", () =>
  assert.equal(nextBusinessDay("2025-12-26", "US").result, "2025-12-29"));
check("previous business day before Mon 2025-06-16 US = Fri 2025-06-13", () =>
  assert.equal(previousBusinessDay("2025-06-16", "US").result, "2025-06-13"));

/* ---------- count_business_days ---------- */
check("count inclusive Mon-Fri 2025-06-23..2025-06-27 US = 5 (holiday-free week)", () =>
  assert.equal(countBusinessDays("2025-06-23", "2025-06-27", "US").businessDays, 5));
check("count Mon-Fri week containing Juneteenth 2025-06-16..2025-06-20 US = 4", () =>
  assert.equal(countBusinessDays("2025-06-16", "2025-06-20", "US").businessDays, 4));
check("count includes both endpoints by default", () =>
  assert.equal(countBusinessDays("2025-06-16", "2025-06-16", "US").businessDays, 1));
check("count exclusive drops the start", () =>
  assert.equal(countBusinessDays("2025-06-16", "2025-06-17", "US", { inclusive: false }).businessDays, 1));
check("count excludes Christmas week holiday US 2025-12-22..2025-12-26 = 4", () =>
  assert.equal(countBusinessDays("2025-12-22", "2025-12-26", "US").businessDays, 4));
check("count weekend breakdown over a full week = 2 weekend days", () =>
  assert.equal(countBusinessDays("2025-06-16", "2025-06-22", "US").weekendDays, 2));
check("count throws when end before start", () => {
  assert.throws(() => countBusinessDays("2025-06-20", "2025-06-16", "US"));
});

/* ---------- country_rule / confidence ---------- */
check("US is verified tier-1 with holidays applied", () => {
  const r = countryRule("US");
  assert.equal(r.confidence, "verified");
  assert.equal(r.holidaysApplied, true);
});
check("Qatar: weekend known but no holiday calendar -> flagged", () => {
  const r = countryRule("QA");
  assert.equal(r.holidaysApplied, false);
  assert.equal(r.notes.some((n) => n.includes("No public-holiday calendar")), true);
});
check("lowercase country code is accepted", () =>
  assert.equal(countryRule("gb").country, "GB"));
check("invalid country code throws", () => {
  assert.throws(() => countryRule("XYZ"));
});

/* ---------- hardening fixes (from code review) ---------- */
check("UK is aliased to GB with holidays applied", () => {
  const r = countryRule("UK");
  assert.equal(r.country, "GB");
  assert.equal(r.holidaysApplied, true);
  assert.equal(r.notes.some((n) => n.includes("UK")), true);
});
check("UK Christmas 2025-12-25 is NOT a business day (alias finds GB holidays)", () =>
  assert.equal(isBusinessDay("2025-12-25", "UK").isBusinessDay, false));
check("mutating returned weekend array does not corrupt the cache", () => {
  const r1 = countryRule("US");
  r1.weekend.push(99);
  assert.deepEqual(countryRule("US").weekend, [6, 7]);
});
check("large add resolves within the safety cap", () =>
  assert.equal(isBusinessDay(addBusinessDays("2025-01-01", 250, "US").result, "US").isBusinessDay, true));
check("absurd date range is rejected", () => {
  assert.throws(() => countBusinessDays("1000-01-01", "9000-01-01", "US"));
});
check("invalid date throws", () => {
  assert.throws(() => isBusinessDay("2025-13-40", "US"));
});

/* ---------- core / handleRpc (the hosted HTTP + Worker wire path) ---------- */
check("initialize returns serverInfo bizdays", () => {
  const r: any = handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(r.result.serverInfo.name, "bizdays");
});
check("tools/list returns 6 tools", () => {
  const r: any = handleRpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(r.result.tools.length, 6);
});
check("tools/call add_business_days skips Christmas", () => {
  const r: any = handleRpc({
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "add_business_days", arguments: { start: "2025-12-24", days: 1, country: "US" } },
  });
  const out = JSON.parse(r.result.content[0].text);
  assert.equal(out.result, "2025-12-26");
});
check("tools/call coerces numeric days from string", () => {
  const r: any = handleRpc({
    jsonrpc: "2.0", id: 4, method: "tools/call",
    params: { name: "add_business_days", arguments: { start: "2025-06-13", days: "1", country: "US" } },
  });
  assert.equal(JSON.parse(r.result.content[0].text).result, "2025-06-16");
});
check("notifications/initialized produces no response", () =>
  assert.equal(handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }), null));
check("unknown method returns -32601", () => {
  const r: any = handleRpc({ jsonrpc: "2.0", id: 5, method: "nope" });
  assert.equal(r.error.code, -32601);
});
check("tools/call on a bad date surfaces a JSON-RPC error", () => {
  const r: any = handleRpc({
    jsonrpc: "2.0", id: 6, method: "tools/call",
    params: { name: "is_business_day", arguments: { date: "2025-13-40", country: "US" } },
  });
  assert.ok(r.error && typeof r.error.message === "string");
});

/* ---------- summary ---------- */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
