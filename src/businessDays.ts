import { weekendInfo, isWeekendDay, type WeekendSource } from "./weekends.js";
import { holidaySupported, publicHolidayOn, type HolidayHit } from "./holidays.js";
import { parseISODate, formatISODate, addDays, weekdayName } from "./dates.js";
import { TIER1 as TIER1_CODES } from "./data.generated.js";

// Curated data via the generated module (no node:fs → Worker-bundleable).
const TIER1 = new Set(TIER1_CODES.map((c) => c.toUpperCase()));

// Common non-ISO inputs mapped to their ISO 3166-1 alpha-2 code. "UK" is the big
// one: the ISO code is GB, and date-holidays only has a calendar under GB.
const ALIASES: Record<string, string> = { UK: "GB", EL: "GR" };

// Safety cap so a malformed weekend rule (e.g. an override listing all 7 days)
// can never spin addBusinessDays into an unbounded loop.
const MAX_SCAN_DAYS = 200000;

export type Confidence = "verified" | "unverified";

export interface CountryRule {
  country: string;
  /** ISO weekday numbers (1=Mon..7=Sun) treated as weekend. */
  weekend: number[];
  weekendSource: WeekendSource;
  weekendNote?: string;
  /** Whether a public-holiday calendar is applied for this country. */
  holidaysApplied: boolean;
  confidence: Confidence;
  notes: string[];
}

/** Resolve the full set of non-working-day rules for a country code. */
export function countryRule(country: string): CountryRule {
  const raw = country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(raw)) {
    throw new Error(`Country must be an ISO 3166-1 alpha-2 code (got "${country}").`);
  }
  const cc = ALIASES[raw] ?? raw;
  const wk = weekendInfo(cc);
  const holidaysApplied = holidaySupported(cc);
  const notes: string[] = [];
  if (cc !== raw) {
    notes.push(`Interpreted country "${raw}" as ${cc}.`);
  }
  if (!holidaysApplied) {
    notes.push(
      `No public-holiday calendar is available for ${cc}; only weekends are excluded. Supply explicit holidays if you need them.`
    );
  }
  if (wk.source === "default") {
    notes.push(`No CLDR weekend data for ${cc}; assumed Saturday/Sunday.`);
  }
  if (wk.note) notes.push(wk.note);
  return {
    country: cc,
    weekend: [...wk.weekend], // copy so callers can't mutate the module cache
    weekendSource: wk.source,
    weekendNote: wk.note,
    holidaysApplied,
    confidence: TIER1.has(cc) ? "verified" : "unverified",
    notes,
  };
}

/** Normalize a caller-supplied list of extra holiday dates (YYYY-MM-DD). */
function extraSet(extra?: string[]): Set<string> {
  const s = new Set<string>();
  for (const d of extra ?? []) {
    parseISODate(d); // validate
    s.add(d);
  }
  return s;
}

function isNonWorking(
  date: Date,
  cc: string,
  extra: Set<string>
): { weekend: boolean; holiday: HolidayHit | null; extra: boolean } {
  const iso = formatISODate(date);
  return {
    weekend: isWeekendDay(date, cc),
    holiday: publicHolidayOn(iso, cc),
    extra: extra.has(iso),
  };
}

export interface IsBusinessDayResult {
  date: string;
  weekday: string;
  isBusinessDay: boolean;
  reason: "business-day" | "weekend" | "public-holiday" | "custom-holiday";
  holiday: HolidayHit | null;
  rule: CountryRule;
}

/** Is a single date a working day in the given country? */
export function isBusinessDay(
  isoDate: string,
  country: string,
  extraHolidays?: string[]
): IsBusinessDayResult {
  const rule = countryRule(country);
  const date = parseISODate(isoDate);
  const extra = extraSet(extraHolidays);
  const nw = isNonWorking(date, rule.country, extra);
  let reason: IsBusinessDayResult["reason"] = "business-day";
  if (nw.weekend) reason = "weekend";
  else if (nw.holiday) reason = "public-holiday";
  else if (nw.extra) reason = "custom-holiday";
  return {
    date: isoDate,
    weekday: weekdayName(date),
    isBusinessDay: !nw.weekend && !nw.holiday && !nw.extra,
    reason,
    holiday: nw.holiday,
    rule,
  };
}

export interface AddBusinessDaysResult {
  start: string;
  days: number;
  result: string;
  resultWeekday: string;
  skippedWeekends: number;
  skippedHolidays: HolidayHit[];
  rule: CountryRule;
}

/**
 * Add (or subtract, if negative) a number of business days to a date.
 * The start date itself is never counted; the result is always a business day.
 */
export function addBusinessDays(
  isoDate: string,
  days: number,
  country: string,
  extraHolidays?: string[]
): AddBusinessDaysResult {
  if (!Number.isInteger(days)) throw new Error("days must be an integer.");
  const rule = countryRule(country);
  const extra = extraSet(extraHolidays);
  let date = parseISODate(isoDate);
  const step = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);
  let skippedWeekends = 0;
  const skippedHolidays: HolidayHit[] = [];
  let scanned = 0;

  while (remaining > 0) {
    if (++scanned > MAX_SCAN_DAYS) {
      throw new Error(
        `Could not resolve ${days} business days within ${MAX_SCAN_DAYS} days — the weekend/holiday rules may exclude every day.`
      );
    }
    date = addDays(date, step);
    const nw = isNonWorking(date, rule.country, extra);
    if (nw.weekend) {
      skippedWeekends++;
    } else if (nw.holiday) {
      skippedHolidays.push(nw.holiday);
    } else if (nw.extra) {
      skippedHolidays.push({ date: formatISODate(date), name: "custom holiday" });
    } else {
      remaining--;
    }
  }

  return {
    start: isoDate,
    days,
    result: formatISODate(date),
    resultWeekday: weekdayName(date),
    skippedWeekends,
    skippedHolidays,
    rule,
  };
}

export interface CountBusinessDaysResult {
  start: string;
  end: string;
  inclusive: boolean;
  businessDays: number;
  weekendDays: number;
  holidays: HolidayHit[];
  totalDays: number;
  rule: CountryRule;
}

/**
 * Count business days between two dates. By default both endpoints are
 * included (inclusive). Set inclusive=false to exclude the start date.
 */
export function countBusinessDays(
  startISO: string,
  endISO: string,
  country: string,
  options?: { inclusive?: boolean; extraHolidays?: string[] }
): CountBusinessDaysResult {
  const inclusive = options?.inclusive ?? true;
  const rule = countryRule(country);
  const extra = extraSet(options?.extraHolidays);
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (end.getTime() < start.getTime()) {
    throw new Error(`end (${endISO}) must not be before start (${startISO}).`);
  }
  const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
  if (spanDays > MAX_SCAN_DAYS) {
    throw new Error(`Range too large (> ${MAX_SCAN_DAYS} days); narrow the date window.`);
  }

  let business = 0;
  let weekend = 0;
  const holidays: HolidayHit[] = [];
  let total = 0;
  let cursor = inclusive ? start : addDays(start, 1);

  while (cursor.getTime() <= end.getTime()) {
    total++;
    const nw = isNonWorking(cursor, rule.country, extra);
    if (nw.weekend) {
      weekend++;
    } else if (nw.holiday) {
      holidays.push(nw.holiday);
    } else if (nw.extra) {
      holidays.push({ date: formatISODate(cursor), name: "custom holiday" });
    } else {
      business++;
    }
    cursor = addDays(cursor, 1);
  }

  return {
    start: startISO,
    end: endISO,
    inclusive,
    businessDays: business,
    weekendDays: weekend,
    holidays,
    totalDays: total,
    rule,
  };
}

/** The next business day strictly after the given date. */
export function nextBusinessDay(
  isoDate: string,
  country: string,
  extraHolidays?: string[]
): AddBusinessDaysResult {
  return addBusinessDays(isoDate, 1, country, extraHolidays);
}

/** The most recent business day strictly before the given date. */
export function previousBusinessDay(
  isoDate: string,
  country: string,
  extraHolidays?: string[]
): AddBusinessDaysResult {
  return addBusinessDays(isoDate, -1, country, extraHolidays);
}
