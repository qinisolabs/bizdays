# bizdays benchmark

Measures how often an unaided LLM gets real business-day questions wrong, versus the
`bizdays` library (which is correct by construction).

## Files
- `generate.mjs` — produces 30 questions across 12 countries with **independent** ground
  truth, computed here from authoritative sources (date-holidays + CLDR), not from the
  library under test.
- `run.mjs` — runs the `bizdays` arm (asserts 100% vs ground truth) and scores an LLM's
  tool-free answers.
- `questions.json` — the generated question set (regenerate with `node generate.mjs`).
- `llm-answers.json` — a recorded baseline: one frontier model, no tools, answers in order.

## Run

```bash
npm run build
node bench/run.mjs                  # score the recorded baseline
node bench/run.mjs my-answers.json  # score your own model run (JSON array of 30 strings)
```

## Recorded baseline (2025 calendar, one frontier model, no tools)

| Task | LLM error |
| --- | --- |
| Count working days in a month | 63% |
| Is this date a working day? | 20% |
| Add N working days | 0% |
| **Overall** | **23%** |

`bizdays`: **0%** (deterministic). The model does fine on small "add N days" hops but breaks
on counting a full month and on non-Western weekend rules.
