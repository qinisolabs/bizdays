import Holidays from "date-holidays";

export interface HolidayHit {
  date: string; // YYYY-MM-DD
  name: string;
}

// One Holidays instance per country (created lazily and reused).
const hdCache = new Map<string, Holidays | null>();
// Per (country, year) map of YYYY-MM-DD -> public-holiday name.
const yearCache = new Map<string, Map<string, string>>();

let supportedSet: Set<string> | null = null;

/** Set of ISO alpha-2 codes for which date-holidays provides a calendar. */
export function supportedCountries(): Set<string> {
  if (!supportedSet) {
    const list = Object.keys(new Holidays().getCountries() ?? {});
    supportedSet = new Set(list.map((c) => c.toUpperCase()));
  }
  return supportedSet;
}

/** Whether a public-holiday calendar exists for this country. */
export function holidaySupported(country: string): boolean {
  return supportedCountries().has(country.toUpperCase());
}

function getHd(country: string): Holidays | null {
  const cc = country.toUpperCase();
  if (hdCache.has(cc)) return hdCache.get(cc)!;
  let hd: Holidays | null = null;
  if (holidaySupported(cc)) {
    try {
      hd = new Holidays(cc);
    } catch {
      hd = null;
    }
  }
  hdCache.set(cc, hd);
  return hd;
}

/**
 * Public holidays for a country and year, keyed by YYYY-MM-DD.
 *
 * IMPORTANT: only entries of type "public" are included. date-holidays' own
 * isHoliday() also returns "observance" and "optional" days (e.g. Valentine's
 * Day, Tax Day, Christmas Eve) which are NOT days off — counting them is the
 * single most common way a naive business-day calculation goes wrong.
 */
export function publicHolidayMap(country: string, year: number): Map<string, string> {
  const cc = country.toUpperCase();
  const key = `${cc}:${year}`;
  const cached = yearCache.get(key);
  if (cached) return cached;

  const map = new Map<string, string>();
  const hd = getHd(cc);
  if (hd) {
    const list = hd.getHolidays(year) ?? [];
    for (const h of list) {
      if (h.type === "public") {
        const day = String(h.date).slice(0, 10); // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DD"
        if (!map.has(day)) map.set(day, h.name);
      }
    }
  }
  yearCache.set(key, map);
  return map;
}

/** Whether a YYYY-MM-DD date is a public holiday in the country; returns the name if so. */
export function publicHolidayOn(isoDate: string, country: string): HolidayHit | null {
  const year = Number(isoDate.slice(0, 4));
  const name = publicHolidayMap(country, year).get(isoDate);
  return name ? { date: isoDate, name } : null;
}
