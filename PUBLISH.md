# Publishing bizdays

Run these on your Mac (they need your npm 2FA passkey and `gh` auth as `kristaffa`).
Run everything from the repo root: `cd bizdays`.

---

## 0. Pre-flight (verify before anything goes public)

```bash
npm install
npm run build
npm test                      # expect: 50 passed, 0 failed
node bench/run.mjs            # expect: bizdays 30/30 (100%)
npm pack --dry-run            # confirm it ships ONLY: dist/ data/ README.md LICENSE NOTICE
```

Scrub check (should print nothing):

```bash
grep -rniE "claude|anthropic|/Users/|qiniso-user|example" src data docs bench README.md
```

---

## 1. Publish to npm (Step 7)

You must be logged in as **qinisolabs**. npm versions are permanent — the pre-flight above is the gate.

```bash
npm whoami                    # must print: qinisolabs   (else: npm login)
npm run build
npm publish --access public   # 2FA passkey will prompt
```

Verify: <https://www.npmjs.com/package/@qinisolabs/bizdays>

---

## 2. GitHub repo + push (Step 8)

⚠️ **Git identity gotcha.** If the per-repo email is skipped, commits fall back to the global
config (your personal/work email) and GitHub attributes the repo to the wrong account. The
`git config user.email` line below MUST print `qinisolabs@gmail.com` before the first commit.

```bash
git init
git config user.name "Qiniso"
git config user.email "qinisolabs@gmail.com"   # per-repo, NOT --global
git config user.email                          # MUST print qinisolabs@gmail.com

git add .
git commit -m "Initial commit: bizdays"
git branch -M main
gh repo create qinisolabs/bizdays --source=. --remote=origin --push --public \
  --description "Verified business-day math for AI agents: holidays + per-country weekends, not guesses."
```

(For the contributor avatar to show as the org owner, `qinisolabs@gmail.com` must be added +
verified on the `kristaffa` GitHub account under Settings → Emails.)

---

## 3. Register in the official MCP Registry (Step 9)

`server.json` is already in the repo (schema `2025-12-11`, name `io.github.qinisolabs/bizdays`,
matching `mcpName` in package.json). Publishing under `io.github.qinisolabs` needs the org
membership public (already set).

```bash
mcp-publisher login github
mcp-publisher publish
```

If the registry schema has changed since this was written, re-check the quickstart and update
`server.json` (camelCase fields, `description` ≤ 100 chars, reference the published npm package).

---

## 3b. Deploy the hosted endpoint (Cloudflare Worker)

The hosted MCP at `bizdays.qinisolabs.workers.dev/mcp` is what the landing page's
"Add custom connector" points to. Deploy it with wrangler, on the same Cloudflare
account as qiniso. Free tier (100k req/day); stateless, no secrets:

```bash
npm i -g wrangler        # or use npx wrangler
wrangler login           # browser auth → qinisolabs Cloudflare account
npm run deploy           # = wrangler deploy (runs gen-data, bundles src/worker.ts)
```

Verify:

```bash
curl https://bizdays.qinisolabs.workers.dev/health      # {"status":"ok"}
curl -s -X POST https://bizdays.qinisolabs.workers.dev/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'    # lists 6 tools
```

> Updates are versioned: bump `version` in package.json **and** server.json (now 0.2.0),
> then `npm publish`, `git push`, `mcp-publisher publish`, and `npm run deploy` again.

---

## 4. GitHub Pages (Step 10)

Repo → **Settings → Pages → Deploy from branch → `main` / `/docs`**.
Live at <https://qinisolabs.github.io/bizdays>. The page (`docs/index.html`) already has the
logo, favicon and `docs/llms.txt`.

---

## 5. Directories (Step 11)

- **Glama** (glama.ai) → Add MCP Server → **Server** tab. Name `bizdays`, the README one-liner,
  repo URL `https://github.com/qinisolabs/bizdays` → Submit for Review. **Do not enter billing.**
- **mcp.so** → Submit. Type "MCP Server", name `bizdays`, GitHub URL, and server config:
  ```json
  {"mcpServers":{"bizdays":{"command":"npx","args":["-y","@qinisolabs/bizdays"]}}}
  ```
- **awesome-mcp-servers** → PR to `punkpeye/awesome-mcp-servers`:
  `- [qinisolabs/bizdays](https://github.com/qinisolabs/bizdays) 📇 🏠 - Verified business-day math (holidays + per-country weekends) for AI agents.`
  (Merge gates on a Glama listing + score badge — add the badge once Glama has indexed it.)
- **Smithery** — stdio tools don't fit its HTTP-only Publish form; rely on auto-ingest from the
  official Registry. `smithery.yaml` is already in the repo for if/when the CLI path is used.

---

## 6. Launch (Step 12, when you say you're ready)

Lead with the benchmark finding, not a pitch: *a frontier model with no tools was wrong 63% of
the time counting working days in a month, and flips weekend rules for the Gulf — bizdays is
100%.* Post to Show HN, r/mcp, r/ClaudeAI and an MCP Discord, using the brand accounts.
