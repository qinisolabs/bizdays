#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  isBusinessDay,
  addBusinessDays,
  countBusinessDays,
  nextBusinessDay,
  previousBusinessDay,
  countryRule,
} from "./index.js";

const server = new McpServer({ name: "bizdays", version: "0.1.0" });

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function safe(fn: () => unknown) {
  try {
    return json(fn());
  } catch (err) {
    return json({ error: (err as Error).message });
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const country = z
  .string()
  .length(2)
  .describe("ISO 3166-1 alpha-2 country code, e.g. US, GB, AE, SA, ZA.");
const date = z
  .string()
  .regex(ISO_DATE, "Date must be in YYYY-MM-DD format.")
  .describe("A calendar date in YYYY-MM-DD format.");
const extraHolidays = z
  .array(z.string().regex(ISO_DATE, "Each holiday must be YYYY-MM-DD."))
  .optional()
  .describe("Optional extra non-working dates (YYYY-MM-DD), e.g. a company shutdown day.");

server.tool(
  "add_business_days",
  "USE THIS to compute a deadline or settlement date instead of counting on your fingers — never guess what date is N working days away. Adds (or subtracts, if N is negative) business days to a start date, skipping that country's weekends AND its public holidays. Weekends are country-correct (e.g. Friday/Saturday in Saudi Arabia, Saturday/Sunday in the UAE) and only real public holidays are skipped — not observances like Valentine's Day. Returns the result date, its weekday, and exactly which weekends/holidays were skipped. Call this for SLAs, payment terms (net-N), shipping ETAs, or any 'X working days from now' question.",
  { start: date, days: z.number().int().describe("Number of business days to add; negative subtracts."), country, extraHolidays },
  async ({ start, days, country, extraHolidays }) =>
    safe(() => addBusinessDays(start, days, country, extraHolidays))
);

server.tool(
  "count_business_days",
  "USE THIS to count working days between two dates instead of estimating — LLMs routinely miscount because they forget holidays or a country's weekend rule. Counts business days from start to end (both endpoints included by default), excluding that country's weekends and public holidays. Returns the count plus a breakdown of weekend days and the named holidays that fell in the range. Use for billing periods, accrued working days, processing-time estimates or SLA windows.",
  {
    start: date,
    end: date,
    country,
    inclusive: z.boolean().optional().describe("Include both endpoints (default true). Set false to exclude the start date."),
    extraHolidays,
  },
  async ({ start, end, country, inclusive, extraHolidays }) =>
    safe(() => countBusinessDays(start, end, country, { inclusive, extraHolidays }))
);

server.tool(
  "is_business_day",
  "USE THIS to check whether a specific date is a working day before scheduling on it — do not assume any weekday is open. Returns whether the date is a business day in the given country and, if not, the precise reason (weekend, public holiday with its name, or a custom holiday). Country-correct weekends and public-holidays-only (no observances).",
  { date, country, extraHolidays },
  async ({ date, country, extraHolidays }) => safe(() => isBusinessDay(date, country, extraHolidays))
);

server.tool(
  "next_business_day",
  "USE THIS to find the next working day after a date (e.g. when something falls due on a weekend or holiday) instead of guessing the next open day. Returns the first business day strictly after the given date for that country.",
  { date, country, extraHolidays },
  async ({ date, country, extraHolidays }) => safe(() => nextBusinessDay(date, country, extraHolidays))
);

server.tool(
  "previous_business_day",
  "USE THIS to find the most recent working day before a date (e.g. the last open day before a holiday) instead of guessing. Returns the first business day strictly before the given date for that country.",
  { date, country, extraHolidays },
  async ({ date, country, extraHolidays }) =>
    safe(() => previousBusinessDay(date, country, extraHolidays))
);

server.tool(
  "country_rule",
  "USE THIS to see how bizdays treats a country before relying on a result — it returns the weekend days (with their source: a Qiniso override, CLDR, or the Sat/Sun default), whether a public-holiday calendar is applied, a confidence flag (verified vs unverified), and any caveats. Call this when a country looks unusual (Gulf states, Israel, Nepal) or when a result is surprising.",
  { country },
  async ({ country }) => safe(() => countryRule(country))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("bizdays MCP server failed to start:", err);
  process.exit(1);
});
