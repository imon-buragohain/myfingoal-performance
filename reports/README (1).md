# myfingoal-performance

**k6 + Grafana Cloud — API Performance Testing Framework**

---

## Why this project exists

This project is a companion to [myfingoal-automation](https://github.com/imon-buragohain/myfingoal-automation) — the Playwright/Cucumber functional test framework built on the same application.

Functional tests tell you whether the application works correctly. Performance tests tell you whether it works at scale — how it behaves under concurrent load, where it degrades, and whether it recovers cleanly. Both matter. A system that produces correct results but collapses under ten simultaneous users isn't production-ready.

I built this framework for the same reason I built the functional one: most QA portfolios don't include performance testing at all, and the ones that do tend to use JMeter — a tool that generates XML config files, produces dated reports, and is genuinely difficult to version-control in a way that reads naturally to a reviewer. I wanted something that treated performance tests as real code, lived cleanly in GitHub, and produced reports worth showing to an employer.

**k6** fits that description. Scripts are plain JavaScript, readable without explanation, version-controlled like any other source file. Results stream to **Grafana Cloud** in real time, producing shareable dashboards with response time graphs, VU ramp curves, and per-endpoint breakdowns — all from a free account.

---

## What's being tested

The myfingoal API — a Python FastAPI backend that performs financial calculations for Australian families. Three endpoints are under test:

| Endpoint | Calculator | Complexity |
|---|---|---|
| `POST /api/calculate` | Property Owner | Heaviest: 480-month mortgage simulation, age pension means test, bisection solver, investment compounding |
| `POST /api/calculate-fhb` | First Home Buyer | Moderate: stamp duty lookup, FHOG eligibility, FHSS calculation, entry strategy comparison |
| `POST /api/calculate-renter` | Smart Renter | Heaviest: rent projection, portfolio simulation, non-homeowner pension means test |

The endpoints handle real Australian financial rules: 2025-26 ATO tax rates, state-specific stamp duty concessions, First Home Guarantee Scheme eligibility, age pension means testing with deeming rate calculations. The calculations are non-trivial, which makes the performance results meaningful.

---

## Test suite

Five test types, covering the full performance testing spectrum:

| # | Test | File | Purpose | VUs | Duration |
|---|---|---|---|---|---|
| 1 | Smoke | `01-smoke.js` | Confirm all 3 endpoints respond correctly at minimal load | 1 | ~10s |
| 2 | Load | `02-load.js` | Validate behaviour under expected normal traffic | 20 | 4 min |
| 3 | Stress | `03-stress.js` | Find the degradation point — how far before it breaks? | 100 | 13 min |
| 4 | Spike | `04-spike.js` | Simulate sudden traffic burst — does it recover? | 0→100→0 | ~6 min |
| 5 | Soak | `05-soak.js` | Detect memory leaks and gradual degradation over time | 20 | 45 min |

---

## Key findings

These are real results from the live FastAPI backend running on a local development machine (Windows, uvicorn). Not a managed cloud instance — a laptop. The numbers are deliberately conservative for that reason.

| Metric | Smoke (1 VU) | Load (20 VUs) | Stress (100 VUs) |
|---|---|---|---|
| Avg response | 52ms | 66ms | 815ms |
| p95 response | 65ms | 117ms | 1,930ms |
| p99 response | ~100ms | 188ms | ~2,500ms |
| Error rate | 0.00% | 0.00% | 0.00% |
| Throughput | ~1 req/s | 7.4 req/s | 26.6 req/s |
| System CPU peak | ~5% | ~15% | 41.8% |
| FastAPI RAM | 4MB | 4MB | 4MB |

**What the numbers tell you:**

Zero errors across 62,000+ requests across all three test types. RAM held completely flat at 4MB throughout the 13-minute stress test — no memory leaks. CPU climbed proportionally with load and recovered cleanly within 90 seconds of ramp-down. The system degrades gracefully under pressure rather than failing hard.

The FHB endpoint is consistently 2–3× faster than PO and SR. This reflects the calculation complexity difference: FHB does lookups against rules tables, while PO and SR run multi-decade simulations. That kind of per-endpoint insight is why breaking the results down by URL matters.

The breaking point was not reached at 100 VUs. p95 hit 1.93 seconds — just under the 2-second load test threshold — with zero errors. The ceiling is somewhere above 100 concurrent users for a single local instance.

---

## Report generator

Every test run produces a dated HTML report from live data. There is no static report committed to this repo — the report is always generated fresh from the k6 CSV output and the system metrics CSV collected in parallel.

```
k6 CSV output  ──┐
                  ├──▶  generate-report.js  ──▶  reports/load-report-2026-05-14.html
system metrics ──┘
```

The report includes:
- Summary KPI cards (total requests, error rate, avg/p95 response, peak throughput)
- Response time timeline chart (avg + p95 overlaid with VU ramp curve)
- Per-endpoint breakdown table and charts (PO / FHB / SR separately)
- System CPU and RAM timeline (sampled every 3 seconds)
- Threshold pass/fail table

---

## Project structure

```
myfingoal-performance/
├── config/
│   └── thresholds.js              ← shared pass/fail criteria across all tests
├── payloads/
│   ├── po-payload.js              ← realistic Property Owner request body
│   ├── fhb-payload.js             ← realistic First Home Buyer request body
│   └── renter-payload.js          ← realistic Smart Renter request body
├── tests/
│   ├── 01-smoke.js                ← 1 VU, 1 iteration, all 3 endpoints
│   ├── 02-load.js                 ← ramp to 20 VUs, hold, ramp down
│   ├── 03-stress.js               ← ramp to 100 VUs in stages
│   ├── 04-spike.js                ← instant spike to 100 VUs
│   └── 05-soak.js                 ← 20 VUs held for 45 minutes
├── scripts/
│   ├── generate-report.js         ← reads CSVs, calculates stats, renders HTML
│   ├── collect-system-metrics.py  ← captures CPU/RAM every 3s during test run
│   └── templates/
│       └── report-template.js     ← HTML report template (Chart.js graphs)
├── reports/
│   └── samples/                   ← committed sample reports for reference
└── .github/
    └── workflows/
        └── smoke.yml              ← runs smoke test on every push (1 VU, safe)
```

---

## Running the tests

### Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed
- Python with `psutil` installed (`pip install psutil`)
- Node.js (for report generation)
- myfingoal backend running locally (`uvicorn main:app --reload` on port 8000)
- Grafana Cloud account with `K6_CLOUD_TOKEN` set as environment variable

### Full workflow — single test with report

```bash
# Terminal 1 — start system metrics collector
python scripts/collect-system-metrics.py reports/raw/load-system.csv

# Terminal 2 — run the test (streams to Grafana Cloud + saves CSV locally)
k6 run --out csv=reports/raw/load-test.csv --out=cloud tests/02-load.js

# After both finish — generate the HTML report
node scripts/generate-report.js --test load --grafana-url <your-grafana-run-url>
```

### Individual tests

```bash
# Smoke — confirm everything is alive (10 seconds)
k6 run --out=cloud tests/01-smoke.js

# Load — normal traffic simulation (4 minutes)
k6 run --out csv=reports/raw/load-test.csv --out=cloud tests/02-load.js

# Stress — find the breaking point (13 minutes)
k6 run --out csv=reports/raw/stress-test.csv --out=cloud tests/03-stress.js

# Spike — sudden traffic burst (6 minutes)
k6 run --out csv=reports/raw/spike-test.csv --out=cloud tests/04-spike.js

# Soak — memory leak detection (45 minutes)
k6 run --out csv=reports/raw/soak-test.csv --out=cloud tests/05-soak.js
```

### Generate report after any test

```bash
node scripts/generate-report.js --test load
node scripts/generate-report.js --test stress --grafana-url https://...
node scripts/generate-report.js --test stress \
  --k6-csv reports/raw/stress-test.csv \
  --sys-csv reports/raw/stress-system.csv \
  --grafana-url https://...
```

Report is saved to `reports/<test>-report-<date>.html`.

---

## Grafana Cloud dashboards

Live test run results (read-only, no login required):

| Test | Grafana Dashboard |
|---|---|
| Load test | https://imonburagohain.grafana.net/a/k6-app/runs/7534771 |
| Stress test | https://imonburagohain.grafana.net/a/k6-app/runs/7534431 |

---

## System metrics — a note on FastAPI CPU

The `collect-system-metrics.py` script tracks the FastAPI process by PID. Throughout all tests, FastAPI process CPU shows 0.0% while system CPU climbs to 41.8% under 100 VUs.

This is not a measurement error. `uvicorn --reload` spawns worker child processes at startup. The script correctly identifies the parent process PID, but the actual computation runs in the workers. System-wide CPU is the accurate measure of load — the FastAPI process column confirms the parent is alive but correctly shows no direct CPU work.

This is the kind of thing you only discover by running the measurement and questioning the result. The system CPU figures are real and meaningful; the FastAPI CPU column is an architectural artefact of how uvicorn manages processes.

---

## What I learned building this

**k6 scripts are real code, not config files.** Coming from JMeter, the difference is significant. A k6 script is JavaScript you can review in a pull request, diff against previous versions, and understand without opening a GUI. The weighted endpoint distribution, the think-time randomisation, the per-endpoint tagging — these are deliberate engineering decisions visible in the code.

**Percentiles tell a different story to averages.** The load test average was 66ms — fast enough that you might not look further. The p99 was 188ms. Under stress, the average hit 815ms but the p95 was 1,930ms — meaning 5% of users were waiting nearly 2 seconds. Averages hide the tail. p95 and p99 are what users actually experience at the edges.

**The breaking point matters more than the happy path.** Load tests confirm things work. Stress tests tell you where the limits are and — critically — whether the system recovers. A system that degrades gracefully and recovers cleanly is fundamentally different from one that requires a restart. The recovery stage of the stress test is not optional.

**System metrics need a separate process.** k6 measures the network layer — what it sends, what comes back, how long it waits. It has no visibility into what the server is doing internally. CPU climbing from 5% to 41% under load, and RAM staying flat at 50.3% throughout, tells a story k6 alone cannot tell. Running `collect-system-metrics.py` in parallel is a two-terminal habit worth building.

**Windows line endings will silently corrupt CSV parsing.** The system metrics CSV was written with `\r\n` line endings. Splitting on `\n` left `\r` attached to the last column header, making every row lookup return `undefined`. The data was correct; the parser was wrong. `raw.replace(/\r/g, '')` before splitting is now the first line of every CSV reader I write.

---

## Companion project

This framework tests the same application as [myfingoal-automation](https://github.com/imon-buragohain/myfingoal-automation) — a Playwright + Cucumber + TypeScript functional test framework covering stamp duty rules, FHOG eligibility, and Help to Buy scheme logic across all 8 Australian states.

Together they demonstrate a layered test strategy: functional correctness verified by Playwright, performance characteristics measured by k6.

---

## Background

I'm a Test Manager with 20 years of experience across enterprise software. The story behind why I built both of these frameworks is in the [myfingoal-automation README](https://github.com/imon-buragohain/myfingoal-automation) — the short version is that I wanted to close the gap between the strategic work I do professionally and the hands-on technical work I want to be able to do credibly.

Performance testing was a deliberate addition to that goal. It's a discipline that's genuinely underrepresented in QA portfolios, and one where the tooling has improved enough that there's no longer a good excuse for "we don't have time to set it up."
