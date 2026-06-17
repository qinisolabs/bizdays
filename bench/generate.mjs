// Deterministic benchmark generator for bizdays.
//
// Ground truth is computed here from AUTHORITATIVE sources (date-holidays for
// public holidays + Intl/CLDR for weekends) — NOT from the bizdays library under
// test — so the benchmark independently measures how often an unaided LLM gets
// real business-day questions wrong.
//
// Usage: import { generate } from "./generate.mjs"; const items = generate();

import Holidays from "date-holidays";

const OVERRIDES = { BD: [5, 6], NP: [6] }; // curated CLDR corrections (ISO 1=Mon..7=Sun)

function weekendDays(cc) {
  if (OVERRIDES[cc]) return OVERRIDES[cc];
  try {
    const l = new Intl.Locale(`und-${cc}`);
    const w = l.getWeekInfo ? l.getWeekInfo() : l.weekInfo;
    if (w && Array.isArray(w.weekend) && w.weekend.length) return [...w.weekend];
  } catch {}
  return [6, 7];
}
function isoWeekday(d) {
  const x = d.getUTCDay();
  return x === 0 ? 7 : x;
}
const hdCache = new Map();
function publicSet(cc, year) {
  const key = `${cc}:${year}`;
  if (hdCache.has(key)) return hdCache.get(key);
  const set = new Map();
  const hd = new Holidays(cc);
  for (const h of hd.getHolidays(year) ?? []) {
    if (h.type === "public") {
      const day = String(h.date).slice(0, 10);
      if (!set.has(day)) set.set(day, h.name);
    }
  }
  hdCache.set(key, set);
  return set;
}
function iso(d) {
  return d.toISOString().slice(0, 10);
}
function add(d, n) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function parse(s) {
  const [y, m, dd] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}
function nonWorking(d, cc) {
  if (weekendDays(cc).includes(isoWeekday(d))) return "weekend";
  if (publicSet(cc, d.getUTCFullYear()).has(iso(d))) return "holiday";
  return null;
}
function addBiz(startISO, n, cc) {
  let d = parse(startISO);
  const step = n >= 0 ? 1 : -1;
  let rem = Math.abs(n);
  while (rem > 0) {
    d = add(d, step);
    if (!nonWorking(d, cc)) rem--;
  }
  return iso(d);
}
function countBiz(aISO, bISO, cc) {
  let d = parse(aISO);
  const end = parse(bISO);
  let c = 0;
  while (d.getTime() <= end.getTime()) {
    if (!nonWorking(d, cc)) c++;
    d = add(d, 1);
  }
  return c;
}

// Curated question set: a mix of holiday-dense, weekend-edge and neutral cases
// across countries with standard and non-standard weekends.
const ADD = [
  ["2025-12-22", 5, "US"], ["2025-12-22", 5, "GB"], ["2025-07-02", 3, "US"],
  ["2025-04-16", 4, "ZA"], ["2025-04-30", 2, "JP"], ["2025-05-01", 3, "DE"],
  ["2025-06-12", 1, "AE"], ["2025-06-12", 1, "SA"], ["2025-08-13", 5, "IN"],
  ["2025-12-24", 2, "BR"], ["2025-01-23", 4, "AU"], ["2025-03-19", 3, "EG"],
];
const COUNT = [
  ["2025-12-01", "2025-12-31", "US"], ["2025-12-01", "2025-12-31", "GB"],
  ["2025-05-01", "2025-05-31", "GB"], ["2025-04-01", "2025-04-30", "ZA"],
  ["2025-01-01", "2025-01-31", "JP"], ["2025-09-01", "2025-09-30", "US"],
  ["2025-06-01", "2025-06-30", "AE"], ["2025-05-01", "2025-05-31", "IN"],
];
const IS = [
  ["2025-12-25", "US"], ["2025-12-26", "GB"], ["2025-06-13", "SA"],
  ["2025-06-13", "AE"], ["2025-07-04", "US"], ["2025-04-25", "AU"],
  ["2025-10-03", "DE"], ["2025-01-26", "IN"], ["2025-09-23", "SA"],
  ["2025-11-15", "BR"],
];

export function generate() {
  const items = [];
  let id = 0;
  for (const [s, n, cc] of ADD)
    items.push({
      id: ++id, category: "add",
      question: `In ${cc}, what date is ${n} business day(s) after ${s}? Skip ${cc}'s weekends and public holidays. Answer YYYY-MM-DD.`,
      answer: addBiz(s, n, cc),
    });
  for (const [a, b, cc] of COUNT)
    items.push({
      id: ++id, category: "count",
      question: `In ${cc}, how many business days are there from ${a} to ${b} inclusive (excluding ${cc} weekends and public holidays)? Give a number.`,
      answer: String(countBiz(a, b, cc)),
    });
  for (const [d, cc] of IS)
    items.push({
      id: ++id, category: "is",
      question: `In ${cc}, is ${d} a business day (not a weekend or public holiday)? Answer yes or no.`,
      answer: nonWorking(parse(d), cc) ? "no" : "yes",
    });
  return items;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = generate();
  console.log(JSON.stringify(items, null, 2));
  console.error(`generated ${items.length} questions`);
}
