// Single source of truth for bizdays' tools + a minimal, stateless JSON-RPC 2.0
// handler (the wire format of MCP's Streamable HTTP transport). The Cloudflare
// Worker and any HTTP host reuse handleRpc(); the stdio server reuses the same
// TOOLS array via the MCP SDK. No node:fs, no SDK here — so this bundles at the edge.
import {
  isBusinessDay,
  addBusinessDays,
  countBusinessDays,
  nextBusinessDay,
  previousBusinessDay,
  countryRule,
} from "./businessDays.js";

export type ArgType = "string" | "number" | "boolean" | "stringArray";

export interface ToolArg {
  name: string;
  type: ArgType;
  description: string;
  optional?: boolean;
}

export interface ToolSpec {
  name: string;
  description: string;
  args: ToolArg[];
  run: (a: Record<string, unknown>) => unknown;
}

const COUNTRY = "ISO 3166-1 alpha-2 country code, e.g. US, GB, AE, SA, ZA.";
const EXTRA =
  "Optional extra non-working dates (YYYY-MM-DD), e.g. a company shutdown day.";

export const TOOLS: ToolSpec[] = [
  {
    name: "add_business_days",
    description:
      "USE THIS to compute a deadline or settlement date instead of counting on your fingers — never guess what date is N working days away. Adds (or subtracts, if N is negative) business days to a start date, skipping that country's weekends AND its public holidays. Weekends are country-correct (e.g. Friday/Saturday in Saudi Arabia, Saturday/Sunday in the UAE) and only real public holidays are skipped — not observances like Valentine's Day. Returns the result date, its weekday, and exactly which weekends/holidays were skipped.",
    args: [
      { name: "start", type: "string", description: "Start date, YYYY-MM-DD." },
      { name: "days", type: "number", description: "Business days to add; negative subtracts." },
      { name: "country", type: "string", description: COUNTRY },
      { name: "extraHolidays", type: "stringArray", description: EXTRA, optional: true },
    ],
    run: (a) => addBusinessDays(a.start as string, a.days as number, a.country as string, a.extraHolidays as string[] | undefined),
  },
  {
    name: "count_business_days",
    description:
      "USE THIS to count working days between two dates instead of estimating — LLMs routinely miscount because they forget holidays or a country's weekend rule. Counts business days from start to end (both endpoints included by default), excluding that country's weekends and public holidays. Returns the count plus a breakdown of weekend days and the named holidays in range.",
    args: [
      { name: "start", type: "string", description: "Start date, YYYY-MM-DD." },
      { name: "end", type: "string", description: "End date, YYYY-MM-DD." },
      { name: "country", type: "string", description: COUNTRY },
      { name: "inclusive", type: "boolean", description: "Include both endpoints (default true); false excludes the start date.", optional: true },
      { name: "extraHolidays", type: "stringArray", description: EXTRA, optional: true },
    ],
    run: (a) =>
      countBusinessDays(a.start as string, a.end as string, a.country as string, {
        inclusive: a.inclusive as boolean | undefined,
        extraHolidays: a.extraHolidays as string[] | undefined,
      }),
  },
  {
    name: "is_business_day",
    description:
      "USE THIS to check whether a specific date is a working day before scheduling on it — do not assume any weekday is open. Returns whether the date is a business day in the given country and, if not, the precise reason (weekend, public holiday with its name, or a custom holiday). Country-correct weekends and public-holidays-only.",
    args: [
      { name: "date", type: "string", description: "Date, YYYY-MM-DD." },
      { name: "country", type: "string", description: COUNTRY },
      { name: "extraHolidays", type: "stringArray", description: EXTRA, optional: true },
    ],
    run: (a) => isBusinessDay(a.date as string, a.country as string, a.extraHolidays as string[] | undefined),
  },
  {
    name: "next_business_day",
    description:
      "USE THIS to find the next working day after a date (e.g. when something falls due on a weekend or holiday) instead of guessing. Returns the first business day strictly after the given date for that country.",
    args: [
      { name: "date", type: "string", description: "Date, YYYY-MM-DD." },
      { name: "country", type: "string", description: COUNTRY },
      { name: "extraHolidays", type: "stringArray", description: EXTRA, optional: true },
    ],
    run: (a) => nextBusinessDay(a.date as string, a.country as string, a.extraHolidays as string[] | undefined),
  },
  {
    name: "previous_business_day",
    description:
      "USE THIS to find the most recent working day before a date (e.g. the last open day before a holiday) instead of guessing. Returns the first business day strictly before the given date for that country.",
    args: [
      { name: "date", type: "string", description: "Date, YYYY-MM-DD." },
      { name: "country", type: "string", description: COUNTRY },
      { name: "extraHolidays", type: "stringArray", description: EXTRA, optional: true },
    ],
    run: (a) => previousBusinessDay(a.date as string, a.country as string, a.extraHolidays as string[] | undefined),
  },
  {
    name: "country_rule",
    description:
      "USE THIS to see how bizdays treats a country before relying on a result — it returns the weekend days (with their source: a Qiniso override, CLDR, or the Sat/Sun default), whether a public-holiday calendar is applied, a confidence flag (verified vs unverified), and any caveats. Call this when a country looks unusual (Gulf states, Israel, Nepal) or when a result is surprising.",
    args: [{ name: "country", type: "string", description: COUNTRY }],
    run: (a) => countryRule(a.country as string),
  },
];

export const SERVER_INFO = { name: "bizdays", version: "0.2.0" } as const;
export const PUBLIC_BASE = "https://qinisolabs.github.io/bizdays";
const DEFAULT_PROTOCOL = "2025-06-18";

function jsonType(t: ArgType) {
  switch (t) {
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "stringArray":
      return { type: "array", items: { type: "string" } };
    default:
      return { type: "string" };
  }
}

function inputSchema(t: ToolSpec) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const a of t.args) {
    properties[a.name] = { ...jsonType(a.type), description: a.description };
    if (!a.optional) required.push(a.name);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

// Human-readable Title Case for a tool name, uppercasing known acronyms — used for the
// `title` + `readOnlyHint` tool annotations the Claude connector directory requires.
const ACRONYMS = new Set(["iban","vat","vin","gtin","upc","ean","isbn","isbn10","issn","icd10","orcid","gln","sscc","imei","isin","cusip","sedol","lei","aba","eth","btc","tld","url","uuid","ip","id","dni","cpf","cnpj","pesel","bsn","nrn","nif","pt","sa","tckn","ric","rc","nir","ahv","curp","cnp","egn","de","fr","ch","mx","hr","ro","bg","ee","cz","uk","us","eu","sic","icd","fcdo"]);
export function humanizeTitle(name: string): string {
  return name.split("_").map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}
export function toolAnnotations(name: string) {
  return { title: humanizeTitle(name), readOnlyHint: true };
}
export function listTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: inputSchema(t),
    annotations: toolAnnotations(t.name),
  }));
}

/** Coerce one incoming JSON-RPC argument to the declared type. */
function coerce(type: ArgType, v: unknown): unknown {
  if (v === undefined || v === null) return undefined;
  switch (type) {
    case "number":
      return typeof v === "number" ? v : Number(v);
    case "boolean":
      return typeof v === "boolean" ? v : v === "true";
    case "stringArray":
      return Array.isArray(v) ? v.map(String) : undefined;
    default:
      return String(v);
  }
}

export function callTool(name: string, args: Record<string, unknown> | undefined) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) {
    const e: any = new Error(`Unknown tool: ${name}`);
    e.code = -32602;
    throw e;
  }
  const a: Record<string, unknown> = {};
  for (const arg of t.args) a[arg.name] = coerce(arg.type, args?.[arg.name]);
  const result = t.run(a);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: any;
}

/**
 * Handle one JSON-RPC message. Returns the response object, or null for
 * notifications (which must produce no body). Stateless: no sessions.
 */
export function handleRpc(msg: JsonRpcMessage): object | null {
  const { id, method, params } = msg;
  if (id === undefined || method === "notifications/initialized") return null;
  try {
    let result: unknown;
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: params?.protocolVersion ?? DEFAULT_PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { ...SERVER_INFO, websiteUrl: PUBLIC_BASE },
          instructions:
            "bizdays computes business days deterministically from real public holidays (206 countries, public-type only — not observances) and per-country weekend rules (CLDR + curated overrides). Pass an ISO 3166-1 alpha-2 country; weekends are country-correct (e.g. Fri/Sat in Saudi Arabia). The same functions are available as the npm library `@qinisolabs/bizdays` for bulk/offline use.",
        };
        break;
      case "tools/list":
        result = { tools: listTools() };
        break;
      case "tools/call":
        result = callTool(params?.name, params?.arguments);
        break;
      case "ping":
        result = {};
        break;
      default:
        return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
    return { jsonrpc: "2.0", id, result };
  } catch (err: any) {
    return { jsonrpc: "2.0", id, error: { code: err?.code ?? -32603, message: err?.message ?? String(err) } };
  }
}
