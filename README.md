# token-radar-01

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/tukiyatlampu/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/tukiyatlampu/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

Token launch radar: a static dashboard ranking 198 pre-token DeFi protocols by implied value, built only from the DefiLlama snapshot of 2026-11-14 (TVL, seven-day change, listing age, chains, category). The value model is peer-calibrated: each category's multiple is the median market-cap-to-TVL ratio of live-token peers in the same category, computed from the snapshot itself, shrunk toward the global median when a category has few peers, combined with log-scaled TVL (diminishing returns), asymmetric growth (a falling week hurts more than a rising week helps), a maturity factor and a chain-diversification bonus. All 40 watchlist protocols are covered, plus 158 early-radar protocols below the $50M TVL floor. Every ranked protocol ships a concrete 6-step farm plan with cost and time estimates, derived from its category, chains, TVL tier and age. Live-token protocols are shown separately, by market cap, never ranked as implied value.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot>
```

`<snapshot>` is the path to the DefiLlama snapshot JSON file (or a directory containing `snapshot.json`). Node 22, standard library only, no network. Output goes to `out/`: `board.json`, `data.js`, `dossier.json`, plus copies of `dashboard/` and `screenshots/`. Open `out/dashboard/index.html` in a browser — no server needed.

## Files

- `main.ts` — program entry: reads the snapshot, scores every protocol, writes the outputs.
- `lib/model.ts` — the peer-calibrated value model and farm-plan generator.
- `vendor/makefun-board.ts` — dossier builder from the competition kit.
- `dashboard/` — static dashboard (`index.html`, `app.css`, `app.js`): sortable board, text/category/chain/TVL/watchlist filters, live-token view, model explainer, per-protocol detail drawer with model breakdown and farm plan.
- `screenshots/` — board, detail drawer and filtered (Lending) views of the dashboard.
- `board.json` — 198 ranked rows (rank, slug, name, implied value, TVL, farm steps).

Built for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01) on [make.fun](https://make.fun/).
