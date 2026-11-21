# token-radar-01 — TEST_RESULTS.md

Bounty: token-radar-01 ($1,325 USDC), deadline 2026-12-14T10:00:00Z.
Snapshot: DefiLlama 2026-11-14 (`kit/token-radar-01-kit/.../input/snapshot.json`).
All commands run from `~/workspace/makefun-bounty/submissions/token-radar-01` unless noted.

## 1. Full runs (main.ts)

Command (each run):

```
node --experimental-strip-types main.ts --input ~/workspace/makefun-bounty/kit/token-radar-01-kit/token-radar-01-kit/input/snapshot.json --output <dir>
```

| Run | Dir | Exit | Output |
| --- | --- | --- | --- |
| Final 1 | /tmp/tr-final1-r4c | 0 | `token radar: 758 protocols, 40 on the watchlist, 198 rows scored (158 early, 24 live set aside)` + wrote board.json, data.js, dashboard (3 files), screenshots (3 images), dossier.json |
| Final 2 | /tmp/tr-final2-r4c | 0 | identical output |
| Zero-fail QA (clean dir) | /tmp/qa-out-r4 (package copied to /tmp/qa-clean-r4) | 0 | identical output; board.json, data.js, dossier.json byte-identical to final1 (verified with `cmp`) |

## 2. Determinism (sha256, byte-identical across final1, final2, QA)

| File | sha256 |
| --- | --- |
| board.json | `02c8939445e7e12166d9855653f55eac63be255206066aafe7d1d4c31f9becff` |
| data.js | `6574e5d9192e9a03ca8232c4509dd6b6c137db57c464ea3c0a29d46a745fc1f4` |
| dossier.json | `60e6517fd5e45855c9667c5d89c57925bfb19ea243f4586fdaa9444455423281` |

## 3. Gate check (local, 34 checks, /tmp/tr-check-r4.mjs)

Command:

```
node /tmp/tr-check-r4.mjs <output-dir>
```

Result on final1 and final2: **34 PASS, 0 FAIL**. Highlights:

- board rows = 198 (40 watchlist + 158 early); watchlist 40/40, missing: none
- ranks 1..198 exact; implied strictly decreasing (then TVL desc, slug asc)
- farm steps 6 each; no reward promises; deployed_usd within capital
  (0 = research-only, 69 rows)
- live 24, market cap descending; calibration peers 34, cohort n=128
- model_version radar-3, category_prior 12; every peer has a per-category
  weight (0 < w ≤ 0.15); Risk Curators weight 0.0115 (n=1)
- evaluation: Spearman full 0.4372 ≥ starter 0.4320; MedAPE full 0.8704 ≤
  starter 0.8859; matched-global Spearman 0.4350, MedAPE 0.8726 — category
  calibration is worth +0.0022 Spearman and 0.22 MedAPE points
- dashboard 65,230 bytes (limit 64 KiB), no http/https; dossier holds the
  full source (contains `</html>`, no "left out" line); dossier 666,679 bytes
  (limit 1.5 MiB); data.js rows match board.json

## 4. Dossier

- Size: 666,679 bytes (limit 1.5 MiB).
- Dashboard source total: 65,230 bytes (index.html 13,424 + app.css 8,888 +
  app.js 42,918; limit 64 KiB = 65,536).
- "left out" count: **0** — the full dashboard source is present in the dossier
  (the 65,536-byte text cap counts ~300 bytes of framing overhead, so the
  effective source limit is ~65,240; earlier builds that exceeded it lost
  tail bytes; fixed by compacting the ablation code and trimming copy).

## 5. Screenshots (rendered with headless Chrome 157)

`/usr/bin/google-chrome` is not installed in this VM and
`/opt/meta-chromium/chrome` refuses to start (Hatch WebGL policy), so Chrome
157 was installed via `npx puppeteer browsers install chrome` and used for
the renders. Command per shot:

```
chrome --headless --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --window-size=1280,800 --virtual-time-budget=8000 \
  --screenshot=<out> <file:// URL>
```

| File | URL hash | Size | sha256 |
| --- | --- | --- | --- |
| screenshots/1-board.png | (none) | 133,298 B, 1280x800 | `6ccc6b62972411339b83835c2d5b4bf02a05ffd2bf3f482647ce1f7cccbee03c` |
| screenshots/2-detail.png | #detail=steakhouse-financial | 190,873 B, 1280x800 | `1ba452874739480269f1fea59cf8bef3c34738d721265ffc83dcdeea34970c6e` |
| screenshots/3-filtered.png | #category=Lending | 124,939 B, 1280x800 | `ff97b87344464b4fa204b6d6a482fb1285ee67196b61492672ddc81fbc62a5d6` |

All three ≤ 256 KiB, PNG 1280x800, viewed and verified by eye: board shows
rank 1 Steakhouse Financial $131.1M, 198 rows, watchlist 40/40, median $23.7M
(watchlist), 33 categories, Early radar 138, and the lede "heuristic score
expressed in dollars… Not a price, not a promise"; detail drawer shows rank 1
Steakhouse Financial with full dollar amounts (Implied value $131,087,042;
TVL $2,753,981,495) and the farm plan (Budget $135, Deploys up to $67.5,
Max fees $20, Hold 14 days); filtered view shows Category Lending,
"16 of 198 rows shown · 16 deployment planned, 0 research-only". Screenshots
in /output are byte-identical to the package copies (verified with sha256sum).

Extra renders verified by eye / DOM: Model tab (exact equations, calibration
check, ranking sensitivity, output composition), mobile 320 px (tab strip wraps,
all four labels visible), 320x1400 tall render.

## 6. Hash / interaction checks (headless Chrome --dump-dom, verified)

- `#plan=research` → "69 of 198 rows shown · 0 deployment planned, 69 research-only"
- `#category=constructor` and `#chain=toString` → 198 rows (prototype names reset to "all")
- `#tab=live&lc=constructor` → "24 of 24 shown · the 24 largest non-CEX live-token protocols…"
- `#detail=does-not-exist` → drawer stays hidden, URL normalized
- `#ld=rain` → Live tab selected, Rain drawer opens
- `#sort=name:d` → first board row Zoo Finance (descending name sort)
- `#minTvl=Infinity` → 198 rows (invalid value reset to 0)
- `#plan=research` removal resets the plan filter (readHash default-reset)
- fmtMoney boundaries (shipped function executed in node): 999999 → $1.0M,
  999999999 → $1.00B, 999499 → $999k, 999500 → $1.0M, 2750000000 → $2.75B, 843 → $843
- Model tab renders: "MedAPE 87.0% vs the starter's 88.6%, and Spearman 0.437
  vs the starter's 0.432 and TVL alone at 0.439 — TVL alone, still the
  strongest ranking baseline"; "Matched comparison… MedAPE 87.3% vs 87.0%,
  and Spearman 0.435 vs 0.437… worth 0.22 MedAPE points and 0.0022 of
  Spearman… wins on 78 of 128 peers"; "Output composition vs the starter top
  10 — full model: 7 of 10 with deployment planned, 6 categories; starter:
  7 of 10 with deployment planned, 6 categories"; peers table shows
  Risk Curators n=1, geomean 2.975×, weight 0.011, multiple 0.212×

## 7. Model evaluation numbers (precomputed LOO, shipped in data.js)

Model radar-3: geomean calibration + shrinkage toward a fixed 0.2 prior
(global weight 0.2) + category weight 0.15·n/(n+12) + factor damping ^0.05.
The n-dependent weight is the round-7 judge fix: 12 categories in the cohort
have a single peer, and a fixed 0.15 weight let one ratio pull the multiple
15%; with n/(n+12) a singleton pulls ~1%. Tested in a harness before
adoption: fixed 0.15 gave Spearman 0.4339 / MedAPE 87.02%, while
0.15·n/(n+12) gave 0.4372 / 87.04% — better ranking, same dollar error.

- Full-model MedAPE 87.04% vs starter 88.59%; category-geomean 89.21%,
  global-geomean 87.92%, flat 0.25x 88.75%.
- Spearman vs actual market cap: full 0.4372, starter 0.4320, TVL alone
  0.4385, matched-global 0.4350. The full model **beats the starter on
  both** — Spearman +0.0052, MedAPE −1.55pp — but TVL alone is still the
  strongest ranking baseline (0.4385), disclosed on the dashboard.
- Matched LOO (category multiple → held-out shrunk global): MedAPE 87.26%
  and Spearman 0.4350 vs full 87.04% / 0.4372 — the category calibration is
  worth 0.22pp MedAPE and 0.0022 Spearman; full wins on 78 of 128 peers;
  error quartiles full 48.3%/193.3% vs starter 58.4%/347.6%.
- CEX sensitivity: removing the 9 CEX peers moves the shrunk global multiple
  0.2056 → 0.2078 (1.1%); on the same 119 non-CEX peers full calibration
  86.96% vs CEX-free 86.83% — CEX-free wins by a hair, so keeping CEX is a
  wash; board keeps 10 of its top 10 (max rank move 0); implied values move
  mean 1.01%, max 1.05% per row.
- Top 10: #1 steakhouse-financial $131,087,042; #2 sentora-curator
  $130,875,377; #3 gauntlet $105,259,075; #4 veda $95,983,494;
  #5 usdd $82,388,091; #6 nonce-capital $57,245,944; #7 upshift $53,735,797;
  #8 bittensor-dtao $47,786,001; #9 polymarket-international $43,633,027;
  #10 onre $41,417,668. Median model/starter ratio 1.02×.
- Factor ablation (browser-computed, average-rank Spearman): multiple 10/10
  stay, 0.999250, max move 7; growth 10/10, 0.999913, move 5; maturity 10/10,
  0.999923, move 3; chain 10/10, 0.999986, move 2; log TVL 10/10, 0.999978,
  move 2. Every ablation keeps the whole top 10 — the damped factors carry
  almost no ranking signal, as the dashboard states.
- Output composition vs starter top 10: full model 7/10 deployment-planned,
  6 categories; starter 7/10, 6 categories (a tie; reported honestly).
- Spearman now uses average ranks for ties (standard definition) in both
  lib/model.ts and dashboard/app.js; no ties occur in this cohort's series,
  so the shipped numbers are unchanged — the fix is correctness, not a
  re-scoring.

## 8. 2-Pass Critique (SolAPI gpt-6.1-sol, Mode MAX)

Full dashboard source (index.html + app.css + app.js) + gate output + screenshot
descriptions sent as judge; prompts/answers in /tmp
(tr-critique{,2,3,4,5,6}-prompt.md, tr-critique{,2,3,4,5,6}-answer.md,
tr-critique8-prompt.md, tr-critique8m-prompt.md, tr-critique8m-answer.md).

| Round | Score | Main fixes applied after |
| --- | --- | --- |
| 1 | 64/100 | en-US numbers; English farm plans; drawer order; model breakdown; calibration + provenance sections; LOO evaluation; live toolbar; token-status filter; a11y basics |
| 2 | 81/100 | median() rounding bug; evaluation naming (MedAPE); missing-age wording; full 128-peer cohort shipped; farm step 1/5 detail; fee-cap pills; directional metadata labels; deployed_usd via positionAfter; research-only drawer; focus restore/trap/inert; aria-sort; per-table arrows; sticky column scoping; 640px table-wrap; fractional bars |
| 3 | 84/100 | fractional bar widths; nulls sort last; name-button stopPropagation; renderConstants skips evaluation; "Exact equations" section; farm fee-cap/address disclosure; deep-link validation; skip link inert |
| 4 | 88/100 | factor ablation; per-peer evaluation export (download JSON); starter equations printed; Plan column + filter + counts; skip-link hash fix; invalid-detail guard; focus restore to visible view; finite minTvl; single tab stop per row; order-neutral captions; pinned header z-index 3; tab wrap at 320px; dashboard source back under the dossier text cap |
| 5 | 89/100 | matched LOO (global-multiple variant, wins, quartiles); CEX sensitivity (same-119 comparison, implied % moves); ablation 6 decimals + max move + entering/leaving; discovery audit vs starter; "deployment planned" wording; farm approval/redemption wording; plan reset in readHash; Set-based validation; status focus; skip-link empty-board fallback; full dollar amounts + full-precision check line in drawer; "Recheck in X days"; fmtMoney boundary promotion; sort/live-state permalink serialization |
| 6 | 87/100 | Early radar card fixed (158 → 138, computed from rows below the $50M floor — Sentora is not on the watchlist); live-category Set validation; writeHash() in all four sort/live handlers; "Check (approximate ≈)" label; CEX paragraph qualified (ranks only + dollar movement); log-TVL wording ("additional TVL contributes less and less"); factors labelled "heuristic preferences, not fitted predictors"; live count names the non-CEX selection; research note states availability is unknown; farm note points to the DefiLlama listing for the official site |
| 7 | **91/100** | radar-3 model rebuilt to beat the starter (geomean + fixed-prior shrinkage + factor damping; see §7); then the round-7 fixes below |

Round 7 detail: two full-source prompts (74,674 B) returned empty content
twice from SolAPI; the medium prompt (42,391 B — model.ts excerpts + Model
tab + ablation code, with unverifiable items marked UNVERIFIED) returned a
real judgement: **91/100** — Coverage 20/20, Value model 24/30, Farm plans
18/20, Dashboard usability 14/15, Polish 15/15. Fixes applied after round 7
(score rose 87 → 91, still below the ≥95 target):

- #4 sample-size-dependent category weight: w = 0.15·n/(n+12), shared by
  peerStats and the LOO evaluation; per-category weight now shown in the
  peers table and the drawer. Verified in the harness before adoption
  (0.4372 / 87.04% vs fixed-weight 0.4339 / 87.02%).
- #5 matched Spearman: the matched-global variant's Spearman (0.4350) is now
  computed and reported alongside its MedAPE.
- #7 Spearman ties: average ranks in lib/model.ts and dashboard/app.js
  (Pearson on ranks in the ablation too); no ties in this cohort, numbers
  unchanged.
- #8 anti-correlation wording: shrinkage "only dampens" the LOO sensitivity
  (the header comment shows the −0.2/(n−1) dependence), not "removes" it.
- #9 "wins the tail" → "lower median and 75th-percentile error".
- #10 equations: ratio clamp r = clamp(mcap/TVL, 0.02, 3) and the
  max(1, round(…)) rounding are now shown; the cohort table notes geomeans
  use clipped ratios.
- #1 LOO model-selection qualification: the dashboard now labels the scores
  "development diagnostics, not a generalization claim".
- #2 TVL identified as "still the strongest ranking baseline".
- #3 output described as "a heuristic score expressed in dollars".
- #6 "Discovery audit" renamed "Output composition".
- #11 "longest pre-token track records" → "longest time since listing"
  (maturity is a listing-age proxy).

Remaining round-7 deductions (not fixed): #12 farm steps still have no
verified official documentation/route links (none exist in the snapshot;
inventing them would be fabrication); #13 the uniform $20 fee ceiling is
poorly matched to small budgets (40% of a $50 budget) — a proportional
fee cap needs its own farm-model change and validation round; #14 the Model
tab still presents its evidence in dense paragraphs instead of compact
tables (would not fit the 64 KiB dashboard cap without larger cuts);
#1–#3 residual: the LOO win is also the model-selection criterion, the
ranking gain is small (+0.0052 Spearman), and MedAPE 87% is weak in
absolute terms — all disclosed on the dashboard.

## 9. Package files (final)

| File | Size | sha256 |
| --- | --- | --- |
| main.ts | 4,699 B | — |
| lib/model.ts | 62,831 B | — |
| dashboard/index.html | 13,424 B | (dashboard source total 65,230 B) |
| dashboard/app.css | 8,888 B | (dashboard source total 65,230 B) |
| dashboard/app.js | 42,918 B | (dashboard source total 65,230 B) |
| screenshots/1-board.png | 133,298 B | `6ccc6b62972411339b83835c2d5b4bf02a05ffd2bf3f482647ce1f7cccbee03c` |
| screenshots/2-detail.png | 190,873 B | `1ba452874739480269f1fea59cf8bef3c34738d721265ffc83dcdeea34970c6e` |
| screenshots/3-filtered.png | 124,939 B | `ff97b87344464b4fa204b6d6a482fb1285ee67196b61492672ddc81fbc62a5d6` |
| README.md | 2,517 B | `d17352eb0fb575a3a8547fb0684c6ba563e2e76dd9a72df3eab92ed879dba970` |
| LICENSE | 1,099 B | `4093194b8adb546955e791c4b68f1ca004968bc033a7a6d3a9bcfe2dd5e9a921` |
| .makefun/owner.json | 58 B | `2fa59095823d3ea016372f445fa71eb4f3e0a18f451ac8875941e9469b31fcdb` |
| TEST_RESULTS.md | — | — |
| vendor/ | kit files (makefun-board.ts etc., not counted in the dashboard cap) | — |

Generated outputs (written by main.ts to the output dir, not stored in the
package; hashes from /tmp/tr-final1-r4c):

| File | Size | sha256 |
| --- | --- | --- |
| board.json | 345,523 B | `02c8939445e7e12166d9855653f55eac63be255206066aafe7d1d4c31f9becff` |
| data.js | 394,684 B | `6574e5d9192e9a03ca8232c4509dd6b6c137db57c464ea3c0a29d46a745fc1f4` |
| dossier.json | 666,679 B | `60e6517fd5e45855c9667c5d89c57925bfb19ea243f4586fdaa9444455423281` |

## 10. Not verified / known limits

- The model now beats the starter on held-out market cap (Spearman 0.4372 vs
  0.4320; MedAPE 87.04% vs 88.59%), but the ranking gain is small and TVL
  alone still ranks better (0.4385); the dashboard discloses all three
  numbers. The constants were chosen on this cohort's LOO diagnostics, so
  the scores are development diagnostics, not a generalization claim.
- Farm-plan execution routes cannot be verified from the snapshot (no contract
  addresses, no URLs); the drawer says so and defers route confirmation to
  step 1 from official documentation. No addresses/URLs were invented.
- 69 of 198 rows are research-only plans (no funds deployed); availability is
  stated as unknown from the snapshot, with concrete recheck conditions.
- The uniform $20 fee ceiling permits fees up to 40% of a $50 budget; a
  proportional cap is a known remaining fix (judge #13).
- Judge score 91/100 (round 7), below the ≥95 target; remaining deductions
  are listed at the end of §8.
