#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodTypeAny } from "zod";
import { TOOLS, SERVER_INFO, type ToolArg } from "./core.js";

const server = new McpServer({ name: SERVER_INFO.name, version: SERVER_INFO.version });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function zodFor(a: ToolArg): ZodTypeAny {
  let s: ZodTypeAny;
  switch (a.type) {
    case "number":
      s = z.number().int();
      break;
    case "boolean":
      s = z.boolean();
      break;
    case "stringArray":
      s = z.array(z.string().regex(ISO_DATE, "Each holiday must be YYYY-MM-DD."));
      break;
    default:
      // Date-like string args are validated downstream by parseISODate; country
      // codes by countryRule. Keep the schema permissive, fail with a clear message.
      s = z.string();
  }
  s = s.describe(a.description);
  return a.optional ? s.optional() : s;
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

for (const t of TOOLS) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const a of t.args) shape[a.name] = zodFor(a);
  server.tool(t.name, t.description, shape, async (args) => {
    try {
      return json(t.run(args as Record<string, unknown>));
    } catch (err) {
      return json({ error: (err as Error).message });
    }
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("bizdays MCP server failed to start:", err);
  process.exit(1);
});
