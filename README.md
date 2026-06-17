# bizdays

**Verified business-day math for AI agents — holidays + per-country weekends, not guesses.**

LLMs are good at "what's 5 + 3" and bad at "what date is 5 business days after Dec 22nd in the UK." They forget holidays, miscount, and assume every country's weekend is Saturday/Sunday. `bizdays` gives an agent the deterministic answer, with the weekend rule and the holidays it skipped shown in the response.

It's both an **MCP server** (so any agent can call it live) and a **typed TypeScript library** (so you can import the same functions in your own code).

Part of [Qiniso](https://github.com/qinisolabs) — verified, trustworthy data tools for AI agents.

---

## Why it exists

Two things break naive business-day calculations, and `bizdays` fixes both:

1. **Weekends are not Sat/Sun everywhere.** Saudi Arabia, Egypt, Israel and Qatar use Friday/Saturday; Iran's is Friday; India's is Sunday; the UAE moved to Saturday/Sunday in 2022. `bizdays` resolves the weekend from Unicode CLDR per country, with a curated override layer for places CLDR gets wrong (e.g. Bangladesh is Fri/Sat, Nepal is Saturday-only).

2. **"Holiday" must mean a real day off.** Off-the-shelf holiday data often counts *observances* like Valentine's Day, Tax Day or Christmas Eve as holidays. Those are not days off. `bizdays` counts **only public holidays**, so your deadlines don't silently drift.

## Install

```bash
npm install @qinisolabs/bizdays
```

### Use as an MCP server

Run it with `npx -y @qinisolabs/bizdays`, or wire it into an MCP client. Example (Claude Desktop config):

```json
{
  "mcpServers": {
    "bizdays": { "command": "npx", "args": ["-y", "@qinisolabs/bizdays"] }
  }
}
```

Tools exposed:

| Tool | What it answers |
| --- | --- |
| `add_business_days` | What date is N working days from a start date? (N may be negative) |
| `count_business_days` | How many working days between two dates? |
| `is_business_day` | Is this date a working day? If not, why? |
| `next_business_day` | First working day after a date |
| `previous_business_day` | Last working day before a date |
| `country_rule` | How does bizdays treat this country? (weekend, source, confidence) |

### Use as a library

```ts
import { addBusinessDays, countBusinessDays, isBusinessDay } from "@qinisolabs/bizdays";

addBusinessDays("2025-12-22", 5, "GB").result;        // "2025-12-31" (skips Christmas + Boxing Day)
countBusinessDays("2025-12-01", "2025-12-31", "US");  // { businessDays: 22, ... } (excludes Christmas)
isBusinessDay("2025-06-13", "SA").isBusinessDay;       // false — Friday is weekend in Saudi Arabia
isBusinessDay("2025-02-14", "US").isBusinessDay;       // true — Valentine's Day is not a public holiday
```

Every function returns a rich result object: the answer, the weekday, exactly which weekends and named holidays were skipped, the weekend rule and its source, and a confidence flag.

## Data & coverage

- **Holidays:** public holidays for **206 countries** (and subdivisions), via [`date-holidays`](https://github.com/commenthol/date-holidays), filtered to `type: "public"`.
- **Weekends:** Unicode CLDR via the runtime `Intl` API, plus a curated `data/weekend-overrides.json` correction layer maintained by Qiniso.
- **Confidence:** a Tier-1 list of ~65 countries has its weekend rule manually verified and (where a calendar exists) holiday parity-tested; results for those are flagged `verified`. Everything else still works but is flagged `unverified` so the agent knows.
- **No holiday calendar for a country?** (e.g. Qatar, Kuwait, Oman) — `bizdays` still applies the correct weekend and tells you, via `holidaysApplied: false`, that holidays were not applied. Pass `extraHolidays` to supply your own.

Dates are plain `YYYY-MM-DD` strings, handled in UTC — no timezone surprises.

## Notes

- The start date is never counted by `add_business_days`; the result is always a business day.
- `count_business_days` includes both endpoints by default (set `inclusive: false` to drop the start).
- Need company shutdown days or regional holidays? Pass them as `extraHolidays` (an array of `YYYY-MM-DD`).

## License

Apache-2.0. Bundled holiday data is from `date-holidays` (ISC AND CC-BY-3.0); see `NOTICE`.
