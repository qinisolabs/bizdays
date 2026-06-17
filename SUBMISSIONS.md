# bizdays — distribution & submission tracker

Status of every place bizdays should appear. Update the **Status** + **Checked** columns as
things land (don't assume — verify the live listing). Auto-ingest sources need no action but
should still be confirmed.

**Reusable copy**
- One-liner: *Verified business-day math for AI agents — holidays + per-country weekends, not guesses.*
- Connector URL: `https://bizdays.qinisolabs.workers.dev/mcp`
- Repo: `https://github.com/qinisolabs/bizdays` · Site: `https://qinisolabs.github.io/bizdays`
- npm: `@qinisolabs/bizdays`

| Channel | Type | Status | Checked | Notes |
| --- | --- | --- | --- | --- |
| npm | publish | ✅ live (0.2.1) | 2026-06-17 | @qinisolabs/bizdays |
| GitHub repo + Pages | publish | ✅ live | 2026-06-17 | topics + homepage set; Pages built |
| Official MCP Registry | publish | ✅ live (0.2.1, isLatest) | 2026-06-17 | io.github.qinisolabs/bizdays |
| Cloudflare Worker | deploy | ✅ live | 2026-06-17 | /health + /mcp verified; tested live in Claude |
| Glama | auto-ingest from registry | ⏳ pending — verify | — | should appear in days; claim via qinisolabs GitHub, **no billing** |
| mcp.so | auto-ingest / form | ⏳ pending — verify | — | submit if not auto-imported |
| PulseMCP | auto-ingest from registry | ⏳ pending — verify | — | no action expected; confirm |
| awesome-mcp-servers | **manual PR** | ⏳ to do | — | only truly manual step; PR to punkpeye/awesome-mcp-servers |
| Smithery | n/a (stdio) | ➖ skip | — | HTTP-only form; rely on registry ingest |
| Launch post (Show HN / r/mcp / r/ClaudeAI) | manual | ⏳ when ready | — | lead with the 63%-counting / 23%-overall benchmark |

Legend: ✅ done & verified · ⏳ pending · ➖ skip.

**Next actions (manual, do later):** open the awesome-mcp-servers PR; in ~a week verify the
Glama / mcp.so / PulseMCP listings actually appeared and mark them ✅ (or submit manually if not).
