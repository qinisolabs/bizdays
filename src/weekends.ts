import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load curated data at runtime (readFileSync, not JSON import attributes) so we
// stay compatible with Node 18.0+ as declared in package.json `engines`.
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const overridesData = JSON.parse(
  readFileSync(join(DATA_DIR, "weekend-overrides.json"), "utf8")
) as {
  overrides: Record<
    string,
    { weekend: number[]; cldr: number[]; reason: string; source: string }
  >;
};

const OVERRIDES = overridesData.overrides;

export type WeekendSource = "override" | "cldr" | "default";

export interface WeekendInfo {
  /** ISO-8601 weekday numbers that are weekend days: 1=Mon .. 7=Sun. */
  weekend: number[];
  /** Where the rule came from: a Qiniso override, CLDR, or the Sat/Sun default. */
  source: WeekendSource;
  /** Human-readable note (only present for overrides). */
  note?: string;
}

const DEFAULT_WEEKEND = [6, 7]; // Saturday, Sunday

const cache = new Map<string, WeekendInfo>();

/** Resolve CLDR weekend days for a region via Intl, or null if unavailable. */
function cldrWeekend(country: string): number[] | null {
  try {
    const locale = new Intl.Locale(`und-${country}`);
    // Newer runtimes expose getWeekInfo(); older ones a weekInfo getter.
    const anyLocale = locale as unknown as {
      getWeekInfo?: () => { weekend: number[] };
      weekInfo?: { weekend: number[] };
    };
    const info = anyLocale.getWeekInfo ? anyLocale.getWeekInfo() : anyLocale.weekInfo;
    if (info && Array.isArray(info.weekend) && info.weekend.length > 0) {
      return [...info.weekend].sort((a, b) => a - b);
    }
  } catch {
    /* fall through to default */
  }
  return null;
}

/**
 * Resolve the weekend rule for an ISO 3166-1 alpha-2 country code.
 * Order: curated Qiniso override → CLDR (via Intl) → Sat/Sun default.
 */
export function weekendInfo(country: string): WeekendInfo {
  const cc = country.toUpperCase();
  const cached = cache.get(cc);
  if (cached) return cached;

  let info: WeekendInfo;
  const override = OVERRIDES[cc];
  if (override) {
    info = { weekend: [...override.weekend], source: "override", note: override.reason };
  } else {
    const cldr = cldrWeekend(cc);
    info = cldr
      ? { weekend: cldr, source: "cldr" }
      : { weekend: [...DEFAULT_WEEKEND], source: "default" };
  }
  cache.set(cc, info);
  return info;
}

/** Convert a JS Date's getUTCDay() (0=Sun..6=Sat) to ISO weekday (1=Mon..7=Sun). */
export function isoWeekday(date: Date): number {
  const d = date.getUTCDay();
  return d === 0 ? 7 : d;
}

/** Whether the given UTC date falls on a weekend in the given country. */
export function isWeekendDay(date: Date, country: string): boolean {
  return weekendInfo(country).weekend.includes(isoWeekday(date));
}
