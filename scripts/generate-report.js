#!/usr/bin/env node
/**
 * generate-report.js
 * Reads k6 CSV output + optional system metrics CSV,
 * calculates all statistics, and renders a full HTML report.
 *
 * Usage:
 *   node scripts/generate-report.js --test load
 *   node scripts/generate-report.js --test stress --grafana-url https://...
 *   node scripts/generate-report.js --k6-csv reports/raw/load.csv --sys-csv reports/raw/load-system.csv --test load
 *
 * Defaults (if flags not provided):
 *   --k6-csv   reports/raw/<test>-test.csv
 *   --sys-csv  reports/raw/<test>-system.csv   (optional — skipped if missing)
 *   --out      reports/<test>-report-<date>.html
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { renderReport } = require('./templates/report-template');

// ── CLI argument parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

if (!args.test) {
  console.error('Error: --test flag is required. Example: node generate-report.js --test load');
  console.error('Valid values: smoke | load | stress | spike | soak');
  process.exit(1);
}

const testType     = args.test.charAt(0).toUpperCase() + args.test.slice(1);
const testFileMap  = { smoke: '01-smoke.js', load: '02-load.js', stress: '03-stress.js', spike: '04-spike.js', soak: '05-soak.js' };
const testFile     = testFileMap[args.test.toLowerCase()] || `${args.test}.js`;
const k6CsvPath    = args['k6-csv']  || path.join('reports', 'raw', `${args.test}-test.csv`);
const sysCsvPath   = args['sys-csv'] || path.join('reports', 'raw', `${args.test}-system.csv`);
const grafanaUrl   = args['grafana-url'] || null;
const dateStr      = new Date().toISOString().slice(0, 10);
const outputPath   = args.out || `reports/${args.test}-report-${dateStr}.html`;

console.log(`\n myfingoal Report Generator`);
console.log(` ─────────────────────────────`);
console.log(` Test type  : ${testType}`);
console.log(` k6 CSV     : ${k6CsvPath}`);
console.log(` System CSV : ${sysCsvPath} ${fs.existsSync(sysCsvPath) ? '(found)' : '(not found — skipping system metrics)'}`);
console.log(` Output     : ${outputPath}\n`);

// ── CSV reader ──────────────────────────────────────────────────────────────

function readCSV(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.trim().replace(/\r/g, '').split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const values = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(cur); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim(); });
    return row;
  });
}

// ── Parse k6 CSV ────────────────────────────────────────────────────────────

function parseK6CSV(filePath) {
  const rows = readCSV(filePath);
  if (!rows) {
    console.error(`Error: k6 CSV not found at ${filePath}`);
    console.error('Make sure you ran k6 with: --out csv=reports/raw/<test>-test.csv');
    process.exit(1);
  }

  // We care about these metrics only
  const KEEP = new Set(['http_req_duration', 'http_reqs', 'http_req_failed', 'vus']);

  // Group duration rows by URL for per-endpoint stats
  // Also collect global duration rows and VU samples
  const durationByUrl = {};   // url -> [value, ...]
  const allDurations  = [];
  const vuSamples     = [];   // { t, vus }
  const reqsByUrl     = {};   // url -> count
  const failsByUrl    = {};   // url -> count of value=1
  const timestamps    = [];

  for (const row of rows) {
    if (!KEEP.has(row.metric_name)) continue;
    const t   = parseInt(row.timestamp, 10);
    const val = parseFloat(row.metric_value);
    const url = row.url || '';

    if (row.metric_name === 'http_req_duration') {
      allDurations.push({ t, val, url });
      if (url) {
        if (!durationByUrl[url]) durationByUrl[url] = [];
        durationByUrl[url].push(val);
      }
      timestamps.push(t);
    }

    if (row.metric_name === 'http_reqs' && url) {
      reqsByUrl[url] = (reqsByUrl[url] || 0) + 1;
    }

    if (row.metric_name === 'http_req_failed' && url) {
      if (!failsByUrl[url]) failsByUrl[url] = { total: 0, failed: 0 };
      failsByUrl[url].total++;
      if (val === 1) failsByUrl[url].failed++;
    }

    if (row.metric_name === 'vus') {
      vuSamples.push({ t, vus: val });
    }
  }

  // ── Stats helpers ──
  function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  function calcStats(values) {
    if (!values.length) return { min: 0, avg: 0, p90: 0, p95: 0, p99: 0, max: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    return {
      min: sorted[0],
      avg,
      p90: percentile(sorted, 90),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1],
    };
  }

  // ── Global stats ──
  const globalStats = calcStats(allDurations.map(r => r.val));

  // ── Per-endpoint stats ──
  const endpoints = Object.entries(durationByUrl).map(([url, values]) => {
    const stats = calcStats(values);
    const fails = failsByUrl[url] || { total: 0, failed: 0 };
    return {
      url,
      count:     reqsByUrl[url] || values.length,
      min:       Math.round(stats.min  * 10) / 10,
      avg:       Math.round(stats.avg  * 10) / 10,
      p95:       Math.round(stats.p95  * 10) / 10,
      errorRate: fails.total > 0 ? (fails.failed / fails.total) * 100 : 0,
    };
  });

  // Sort endpoints by avg desc (heaviest first)
  endpoints.sort((a, b) => b.avg - a.avg);

  // ── Timeline series (bucket by 15s intervals) ──
  const tMin = Math.min(...timestamps);
  const tMax = Math.max(...timestamps);
  const BUCKET = 15; // seconds
  const buckets = {};

  for (const { t, val } of allDurations) {
    const b = Math.floor((t - tMin) / BUCKET) * BUCKET;
    if (!buckets[b]) buckets[b] = [];
    buckets[b].push(val);
  }

  const responseTimeSeries = Object.entries(buckets)
    .sort(([a], [b]) => a - b)
    .map(([offset, vals]) => {
      const sorted = [...vals].sort((a, b) => a - b);
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const p95 = percentile(sorted, 95);
      const mins = Math.floor(parseInt(offset) / 60);
      const secs = parseInt(offset) % 60;
      const t = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      return { t, avg: Math.round(avg), p95: Math.round(p95) };
    });

  // ── VU timeline (bucket same way) ──
  const vuBuckets = {};
  for (const { t, vus } of vuSamples) {
    const b = Math.floor((t - tMin) / BUCKET) * BUCKET;
    if (!vuBuckets[b]) vuBuckets[b] = [];
    vuBuckets[b].push(vus);
  }

  const vuTimeSeries = Object.entries(vuBuckets)
    .sort(([a], [b]) => a - b)
    .map(([offset, vals]) => {
      const vus = Math.max(...vals);
      const mins = Math.floor(parseInt(offset) / 60);
      const secs = parseInt(offset) % 60;
      return { t: `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`, vus };
    });

  // ── Test duration ──
  const durationSecs = tMax - tMin;
  const dMins = Math.floor(durationSecs / 60);
  const dSecs = durationSecs % 60;
  const duration = `${dMins} min ${dSecs} sec`;

  // ── Max VUs ──
  const maxVUs = vuSamples.length ? Math.max(...vuSamples.map(v => v.vus)) : 1;

  // ── Throughput ──
  const totalRequests = allDurations.length;
  const throughputAvg  = durationSecs > 0 ? Math.round((totalRequests / durationSecs) * 10) / 10 : 0;

  // Peak throughput: max reqs in any 15s bucket
  const throughputPeak = Math.max(...Object.values(buckets).map(v => Math.round((v.length / BUCKET) * 10) / 10));

  // ── Error rate ──
  const allFails = Object.values(failsByUrl).reduce((s, v) => ({ total: s.total + v.total, failed: s.failed + v.failed }), { total: 0, failed: 0 });
  const errorRate = allFails.total > 0 ? (allFails.failed / allFails.total) * 100 : 0;

  return {
    duration,
    maxVUs,
    totalRequests,
    throughputAvg,
    throughputPeak,
    errorRate,
    avgResponse:  Math.round(globalStats.avg * 10) / 10,
    p90Response:  Math.round(globalStats.p90 * 10) / 10,
    p95Response:  Math.round(globalStats.p95 * 10) / 10,
    p99Response:  Math.round(globalStats.p99 * 10) / 10,
    maxResponse:  Math.round(globalStats.max * 10) / 10,
    endpoints,
    responseTimeSeries,
    vuTimeSeries,
  };
}

// ── Parse system metrics CSV ────────────────────────────────────────────────

function parseSystemCSV(filePath) {
  const rows = readCSV(filePath);
  if (!rows || rows.length === 0) return null;

  const cpuVals = rows.map(r => parseFloat(r.system_cpu_pct || r.cpu_pct || 0)).filter(v => !isNaN(v));
  const ramVals = rows.map(r => parseFloat(r.system_mem_pct || r.mem_pct || 0)).filter(v => !isNaN(v));
  const fastapiRam = rows.map(r => parseFloat(r.fastapi_mem_mb || 0)).filter(v => !isNaN(v));

  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const cpuTimeSeries = rows.map(r => ({
    t:   r.timestamp,
    cpu: parseFloat(r.system_cpu_pct || r.cpu_pct || 0),
    ram: parseFloat(r.system_mem_pct || r.mem_pct || 0),
  }));

  return {
    cpuMin:        Math.min(...cpuVals),
    cpuMax:        Math.max(...cpuVals),
    cpuAvg:        avg(cpuVals),
    ramMin:        Math.min(...ramVals),
    ramMax:        Math.max(...ramVals),
    ramAvg:        avg(ramVals),
    fastapiRamAvg: avg(fastapiRam),
    samples:       rows.length,
    cpuTimeSeries,
  };
}

// ── Build thresholds from actual results ────────────────────────────────────

function buildThresholds(stats, testTypeLower) {
  const thresholds = [];

  // Error rate threshold
  const errLimit = testTypeLower === 'stress' ? 10 : 1;
  thresholds.push({
    name:      'http_req_failed',
    condition: `rate < ${errLimit}%`,
    result:    `${stats.errorRate.toFixed(2)}%`,
    passed:    stats.errorRate < errLimit,
  });

  // p95 threshold
  const p95Limit = testTypeLower === 'stress' ? 10000 : testTypeLower === 'smoke' ? 5000 : 2000;
  thresholds.push({
    name:      'http_req_duration p(95)',
    condition: `< ${p95Limit}ms`,
    result:    `${Math.round(stats.p95Response)}ms`,
    passed:    stats.p95Response < p95Limit,
  });

  // p99 threshold
  const p99Limit = testTypeLower === 'stress' ? 15000 : 5000;
  thresholds.push({
    name:      'http_req_duration p(99)',
    condition: `< ${p99Limit}ms`,
    result:    `${Math.round(stats.p99Response)}ms`,
    passed:    stats.p99Response < p99Limit,
  });

  // Per-endpoint status checks
  stats.endpoints.forEach(ep => {
    const label = ep.url.includes('calculate-fhb') ? 'FHB' :
                  ep.url.includes('calculate-renter') ? 'SR' : 'PO';
    thresholds.push({
      name:      `${label}: status 200`,
      condition: 'error rate = 0%',
      result:    `${ep.errorRate.toFixed(2)}%`,
      passed:    ep.errorRate === 0,
    });
  });

  return thresholds;
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log(' Parsing k6 CSV...');
const k6Stats = parseK6CSV(k6CsvPath);

console.log(' Parsing system metrics CSV...');
const sysStats = fs.existsSync(sysCsvPath) ? parseSystemCSV(sysCsvPath) : null;

if (!sysStats) console.log(' (No system metrics — section will be omitted from report)');

const thresholds = buildThresholds(k6Stats, args.test.toLowerCase());
const allPassed  = thresholds.every(t => t.passed);

console.log(` Building report data...`);
const reportData = {
  testType,
  testFile,
  generatedAt:        new Date().toISOString(),
  duration:           k6Stats.duration,
  maxVUs:             k6Stats.maxVUs,
  totalRequests:      k6Stats.totalRequests,
  errorRate:          k6Stats.errorRate,
  avgResponse:        k6Stats.avgResponse,
  p90Response:        k6Stats.p90Response,
  p95Response:        k6Stats.p95Response,
  p99Response:        k6Stats.p99Response,
  maxResponse:        k6Stats.maxResponse,
  throughputAvg:      k6Stats.throughputAvg,
  throughputPeak:     k6Stats.throughputPeak,
  endpoints:          k6Stats.endpoints,
  responseTimeSeries: k6Stats.responseTimeSeries,
  vuTimeSeries:       k6Stats.vuTimeSeries,
  cpuTimeSeries:      sysStats ? sysStats.cpuTimeSeries : [],
  systemMetrics:      sysStats,
  grafanaUrl,
  thresholds,
};
console.log(` Rendering HTML...`);
const html = renderReport(reportData);

// Ensure output directory exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');

// Print summary
console.log(`\n ─────────────────────────────`);
console.log(` Report generated successfully`);
console.log(` ─────────────────────────────`);
console.log(` File        : ${outputPath}`);
console.log(` Test type   : ${testType}`);
console.log(` Total reqs  : ${k6Stats.totalRequests.toLocaleString()}`);
console.log(` Avg resp    : ${k6Stats.avgResponse}ms`);
console.log(` p95 resp    : ${k6Stats.p95Response}ms`);
console.log(` Error rate  : ${k6Stats.errorRate.toFixed(2)}%`);
console.log(` Thresholds  : ${allPassed ? '✓ ALL PASSED' : '✗ SOME FAILED'}`);
if (sysStats) {
  console.log(` CPU peak    : ${sysStats.cpuMax.toFixed(1)}%`);
  console.log(` RAM peak    : ${sysStats.ramMax.toFixed(1)}%`);
}
console.log(` ─────────────────────────────\n`);
console.log(` Open: ${outputPath}\n`);
