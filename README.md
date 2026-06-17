<div align="center">

<img src="docs/logo.svg" width="96" height="96" alt="Qiniso" />

# bizdays

**Verified business-day math for AI agents — holidays + per-country weekends, not guesses.**

*Verified, trustworthy data tools for AI agents. "Qiniso" means "truth" in Zulu.*

[Website](https://qinisolabs.github.io/bizdays/) · [MCP endpoint](https://bizdays.qinisolabs.workers.dev/mcp) · [MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=bizdays)

</div>

---

LLMs answer "what date is 5 business days after Dec 22nd in the UK?", "how many working days are in this month?", and "is Friday a working day in Saudi Arabia?" confidently and often **wrongly** — they miscount, forget public holidays, and assume every country's weekend is Saturday/Sunday. **bizdays** gives an agent the deterministic answer from real public-holiday calendars and per-country weekend rules, showing the weekend rule and the exact holidays it skipped.

Two things break naive business-day math, and bizdays fixes both: **weekends aren't Sat/Sun everywhere** (Fri/Sat in Saudi Arabia, Egypt & Israel; Fri in Iran; Sun in India; Sat/Sun in the UAE since 2022), and **"holiday" must mean a real day off** — off-the-shelf data counts observances like Valentine's Day and Christmas Eve, which are not days off.

> Counting the working days in a month, a frontier LLM with no tools is **wrong 63% of the time**, cold — and **23% across business-day questions** overall. **bizdays: 0%.**

## Add it to Claude

Settings → Connectors → **Add custom connector**, and paste — no login, no key:

```
https://bizdays.qinisolabs.workers.dev/mcp
```

Stateless, reads no user data, requires no secrets. Prefer to run it locally over stdio? Add `{ "command": "npx", "args": ["-y", "@qinisolabs/bizdays"] }` under `mcpServers` in your client config.

## Use it as a library

Every tool is also a typed function — no MCP required:

```bash
npm i @qinisolabs/bizdays
```

```ts
import { addBusinessDays, countBusinessDays, isBusinessDay } from "@qinisolabs/bizdays";

addBusinessDays("2025-12-22", 5, "GB").result;       // "2025-12-31" (skips Christmas + Boxing Day)
countBusinessDays("2025-12-01", "2025-12-31", "US"); // { businessDays: 22, ... }
isBusinessDay("2025-06-13", "SA").isBusinessDay;      // false — Friday is weekend in Saudi Arabia
isBusinessDay("2025-02-14", "US").isBusinessDay;      // true  — Valentine's Day is not a public holiday
```

Every function returns a rich result: the answer, the weekday, exactly which weekends and named holidays were skipped, the weekend rule and its source, and a confidence flag.

## What it does — 6 tools

| Tool | What it answers |
| --- | --- |
| **add_business_days** | What date is N working days from a start date? (N may be negative) |
| **count_business_days** | How many working days between two dates? (endpoints inclusive by default) |
| **is_business_day** | Is this date a working day? If not, why (weekend / public holiday with its name)? |
| **next_business_day** | First working day strictly after a date |
| **previous_business_day** | Last working day strictly before a date |
| **country_rule** | The weekend rule + its source, whether holidays apply, and a confidence flag |

Public holidays for **206 countries** (and subdivisions) come from [`date-holidays`](https://github.com/commenthol/date-holidays), filtered to `type: "public"`. Weekends come from **Unicode CLDR** via the runtime `Intl` API, plus a curated `data/weekend-overrides.json` correction layer (e.g. Bangladesh Fri/Sat, Nepal Sat-only) — the maintained data is the moat.

## What it is *not*

- **Not all-holidays.** It counts weekends and **public** holidays only — not regional or optional observances. Pass company shutdowns or regional days via `extraHolidays`.
- **Not uniformly verified.** A Tier-1 set of ~65 countries is verified; others work but are flagged `unverified`. Where no holiday calendar exists (e.g. Qatar, Kuwait, Oman), the correct weekend still applies and the response says so (`holidaysApplied: false`).
- **Not a live service dependency.** The library makes no network calls; dates are `YYYY-MM-DD` in UTC.

## Architecture

A single TypeScript package exposing one MCP server over two transports — **stdio** (local / `npx`) and a **Cloudflare Worker** (the hosted edge endpoint) — both driven by the same `core.ts` tool definitions, which also power the importable library.

```bash
npm install
npm run build
npm test
```

## License

Apache-2.0. Bundled holiday data is from `date-holidays` (ISC AND CC-BY-3.0); see `NOTICE`.
