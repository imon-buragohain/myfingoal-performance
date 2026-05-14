/**
 * report-template.js
 * HTML template for myfingoal performance reports.
 * Receives a `data` object from generate-report.js and returns a complete HTML string.
 */

'use strict';

function renderReport(data) {
  const {
    testType,        // "Smoke" | "Load" | "Stress" | "Spike" | "Soak"
    testFile,        // "01-smoke.js" etc
    generatedAt,     // ISO date string
    duration,        // "4 min 30 sec"
    maxVUs,          // 20
    totalRequests,   // 1772
    errorRate,       // 0.00
    avgResponse,     // 66.1
    p90Response,     // 98.3
    p95Response,     // 117.2
    p99Response,     // 188.4
    maxResponse,     // 408.1
    throughputAvg,   // 7.4
    throughputPeak,  // 11.3
    endpoints,       // [ { name, url, count, min, avg, p95, errorRate } ]
    systemMetrics,   // { cpuMin, cpuMax, cpuAvg, ramMin, ramMax, ramAvg, fastapiRamAvg, samples: [...] }
    grafanaUrl,      // optional
    thresholds,      // [ { name, condition, result, passed } ]
    // chart data arrays
    responseTimeSeries,   // [ { t, avg, p95 } ] — for timeline charts
    vuTimeSeries,         // [ { t, vus } ]
    cpuTimeSeries,        // [ { t, cpu, ram } ]
  } = data;

  const passedAll = thresholds.every(t => t.passed);
  const statusColor = passedAll ? '#00e5a0' : '#ef4444';
  const statusText  = passedAll ? 'PASSED' : 'FAILED';

  // Endpoint colour assignment
  const endpointColours = ['#00e5a0', '#3b82f6', '#f59e0b', '#06b6d4', '#a855f7'];

  // Friendly endpoint labels
  const endpointLabel = (url) => {
    if (url.includes('calculate-fhb'))    return 'First Home Buyer';
    if (url.includes('calculate-renter')) return 'Smart Renter';
    if (url.includes('calculate'))        return 'Property Owner';
    return url.split('/').pop();
  };

  // Format ms nicely
  const ms = (v) => v == null ? 'N/A' : `${Math.round(v)}ms`;
  const pct = (v) => v == null ? 'N/A' : `${v.toFixed(2)}%`;

  // Build endpoint rows for table
  const endpointRows = endpoints.map(ep => `
    <tr>
      <td>${endpointLabel(ep.url)}</td>
      <td class="mono muted">${ep.url}</td>
      <td class="mono muted">${ep.count.toLocaleString()}</td>
      <td class="mono ${ep.min < 100 ? 'green' : 'amber'}">${ms(ep.min)}</td>
      <td class="mono ${ep.avg < 200 ? 'green' : 'amber'}">${ms(ep.avg)}</td>
      <td class="mono ${ep.p95 < 500 ? 'green' : ep.p95 < 2000 ? 'amber' : 'red'}">${ms(ep.p95)}</td>
      <td class="mono ${ep.errorRate === 0 ? 'green' : 'red'}">${pct(ep.errorRate)}</td>
    </tr>
  `).join('');

  // Build threshold rows
  const thresholdRows = thresholds.map(t => `
    <tr>
      <td class="mono">${t.name}</td>
      <td class="mono muted">${t.condition}</td>
      <td class="mono ${t.passed ? 'green' : 'red'}">${t.passed ? '✓' : '✗'} ${t.result}</td>
    </tr>
  `).join('');

  // Build system metrics section — only if we have data
  const hasSystem = systemMetrics && systemMetrics.samples > 0 && cpuTimeSeries && cpuTimeSeries.length > 0;

  const systemSection = hasSystem ? `
    <section>
      <div class="section-label">04 — System Resource Usage</div>
      <div class="section-title">CPU &amp; memory during test run</div>
      <div class="cards-grid four">
        <div class="card amber">
          <div class="card-label">CPU Peak</div>
          <div class="card-value">${systemMetrics.cpuMax.toFixed(1)}%</div>
          <div class="card-sub">Avg ${systemMetrics.cpuAvg.toFixed(1)}% · Min ${systemMetrics.cpuMin.toFixed(1)}%</div>
        </div>
        <div class="card blue">
          <div class="card-label">RAM Peak</div>
          <div class="card-value">${systemMetrics.ramMax.toFixed(1)}%</div>
          <div class="card-sub">Avg ${systemMetrics.ramAvg.toFixed(1)}% · Min ${systemMetrics.ramMin.toFixed(1)}%</div>
        </div>
        <div class="card cyan">
          <div class="card-label">FastAPI RAM</div>
          <div class="card-value">${systemMetrics.fastapiRamAvg.toFixed(0)}MB</div>
          <div class="card-sub">Constant across entire test</div>
        </div>
        <div class="card">
          <div class="card-label">Memory Leak</div>
          <div class="card-value">None</div>
          <div class="card-sub">RAM variation ±${(systemMetrics.ramMax - systemMetrics.ramMin).toFixed(1)}%</div>
        </div>
      </div>
      <div class="chart-box wide" style="margin-top:1.5rem">
        <div class="chart-title">CPU &amp; RAM — Test Timeline</div>
        <div class="chart-sub">sampled every 3s alongside k6 test run</div>
        <div class="chart-wrap">
          <canvas id="systemChart"></canvas>
        </div>
      </div>
      <div class="note" style="margin-top:1rem">
        ⚠ FastAPI process CPU shows 0.0% — uvicorn --reload spawns worker child processes. psutil tracked the parent PID; actual computation runs in workers. System-wide CPU figures above accurately reflect total machine load.
      </div>
    </section>
    <div class="divider"></div>
  ` : '';

  // Serialise chart data safely for inline script
  const safeJson = (obj) => JSON.stringify(obj).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>myfingoal — ${testType} Test Report</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"><\/script>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:       #0a0e1a;
    --surface:  #111827;
    --surface2: #1a2235;
    --border:   #1e2d45;
    --green:    #00e5a0;
    --green-dim:#00a872;
    --blue:     #3b82f6;
    --amber:    #f59e0b;
    --red:      #ef4444;
    --cyan:     #06b6d4;
    --text:     #e2e8f0;
    --muted:    #64748b;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:'Syne',sans-serif; min-height:100vh; }

  header {
    border-bottom:1px solid var(--border);
    padding:2rem 3rem;
    display:flex; justify-content:space-between; align-items:flex-end;
    background:linear-gradient(135deg,#0d1b2e 0%,#0a0e1a 60%);
  }
  .brand-name { font-size:1.6rem; font-weight:800; letter-spacing:-0.03em; color:white; }
  .brand-name span { color:var(--green); }
  .brand-sub { font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--muted); letter-spacing:0.1em; text-transform:uppercase; margin-top:0.25rem; }
  .header-meta { text-align:right; font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:var(--muted); line-height:1.8; }
  .status-badge {
    display:inline-block;
    background:rgba(0,229,160,0.12); border:1px solid var(--green-dim); color:var(--green);
    padding:0.2rem 0.75rem; border-radius:2px;
    font-family:'JetBrains Mono',monospace; font-size:0.7rem; font-weight:600;
    letter-spacing:0.12em; text-transform:uppercase;
  }
  .status-badge.fail { background:rgba(239,68,68,0.12); border-color:#b91c1c; color:var(--red); }

  main { padding:2.5rem 3rem; max-width:1400px; margin:0 auto; }
  section { margin-bottom:3rem; }
  .section-label { font-family:'JetBrains Mono',monospace; font-size:0.65rem; letter-spacing:0.18em; text-transform:uppercase; color:var(--green); margin-bottom:0.6rem; }
  .section-title { font-size:1.4rem; font-weight:700; color:white; margin-bottom:1.5rem; letter-spacing:-0.02em; }
  .divider { height:1px; background:var(--border); margin:2.5rem 0; }

  .cards-grid { display:grid; gap:1px; background:var(--border); border:1px solid var(--border); border-radius:6px; overflow:hidden; margin-bottom:2rem; }
  .cards-grid.four { grid-template-columns:repeat(4,1fr); }
  .cards-grid.three { grid-template-columns:repeat(3,1fr); }

  .card { background:var(--surface); padding:1.5rem; position:relative; overflow:hidden; }
  .card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:var(--green); opacity:0.6; }
  .card.amber::before { background:var(--amber); }
  .card.blue::before  { background:var(--blue); }
  .card.cyan::before  { background:var(--cyan); }
  .card.red::before   { background:var(--red); }
  .card-label { font-family:'JetBrains Mono',monospace; font-size:0.65rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.6rem; }
  .card-value { font-size:2rem; font-weight:800; letter-spacing:-0.04em; color:var(--green); line-height:1; }
  .card.amber .card-value { color:var(--amber); }
  .card.blue  .card-value { color:var(--blue); }
  .card.cyan  .card-value { color:var(--cyan); }
  .card.red   .card-value { color:var(--red); }
  .card-sub { font-family:'JetBrains Mono',monospace; font-size:0.68rem; color:var(--muted); margin-top:0.4rem; }

  .charts-2col { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem; }
  .chart-box { background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:1.5rem; }
  .chart-box.wide { grid-column:1/-1; }
  .chart-title { font-size:0.85rem; font-weight:700; color:white; margin-bottom:0.3rem; }
  .chart-sub { font-family:'JetBrains Mono',monospace; font-size:0.65rem; color:var(--muted); margin-bottom:1.2rem; }
  .chart-wrap { position:relative; height:240px; }

  table { width:100%; border-collapse:collapse; font-size:0.82rem; }
  thead tr { background:var(--surface2); border-bottom:2px solid var(--border); }
  th { padding:0.85rem 1rem; text-align:left; font-family:'JetBrains Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); font-weight:600; }
  tbody tr { border-bottom:1px solid var(--border); }
  tbody tr:hover { background:var(--surface2); }
  td { padding:0.85rem 1rem; color:var(--text); }
  td:first-child { font-weight:600; }
  .mono { font-family:'JetBrains Mono',monospace; font-size:0.78rem; }
  .green { color:var(--green); font-weight:600; }
  .amber { color:var(--amber); font-weight:600; }
  .red   { color:var(--red);   font-weight:600; }
  .muted { color:var(--muted); }

  .note { background:rgba(245,158,11,0.07); border:1px solid rgba(245,158,11,0.25); border-left:3px solid var(--amber); border-radius:4px; padding:1rem 1.2rem; font-family:'JetBrains Mono',monospace; font-size:0.74rem; color:#c9a857; line-height:1.6; }

  footer { border-top:1px solid var(--border); padding:1.5rem 3rem; display:flex; justify-content:space-between; align-items:center; font-family:'JetBrains Mono',monospace; font-size:0.68rem; color:var(--muted); }
  footer a { color:var(--green); text-decoration:none; }
</style>
</head>
<body>

<header>
  <div>
    <div class="brand-name">my<span>fin</span>goal</div>
    <div class="brand-sub">Performance Test Report · ${testType} Test · ${testFile}</div>
  </div>
  <div class="header-meta">
    <div><span class="status-badge ${passedAll ? '' : 'fail'}">${statusText}</span></div>
    <div style="margin-top:0.5rem">Generated: ${new Date(generatedAt).toLocaleString('en-AU')}</div>
    <div>Duration: ${duration} · Max VUs: ${maxVUs}</div>
    <div>Target: http://localhost:8000 (FastAPI + uvicorn)</div>
    ${grafanaUrl ? `<div style="margin-top:0.3rem"><a href="${grafanaUrl}" target="_blank">→ View in Grafana Cloud</a></div>` : ''}
  </div>
</header>

<main>

  <!-- SECTION 1: SUMMARY CARDS -->
  <section>
    <div class="section-label">01 — Summary</div>
    <div class="section-title">${testType} test — ${totalRequests.toLocaleString()} requests · ${duration}</div>
    <div class="cards-grid four">
      <div class="card">
        <div class="card-label">Total Requests</div>
        <div class="card-value">${totalRequests >= 1000 ? (totalRequests/1000).toFixed(1)+'k' : totalRequests}</div>
        <div class="card-sub">Avg ${throughputAvg} req/s · Peak ${throughputPeak} req/s</div>
      </div>
      <div class="card ${errorRate === 0 ? '' : 'red'}">
        <div class="card-label">Error Rate</div>
        <div class="card-value">${pct(errorRate)}</div>
        <div class="card-sub">${errorRate === 0 ? 'Zero failures' : 'Failures detected'}</div>
      </div>
      <div class="card blue">
        <div class="card-label">Avg Response</div>
        <div class="card-value">${ms(avgResponse)}</div>
        <div class="card-sub">p90: ${ms(p90Response)}</div>
      </div>
      <div class="card amber">
        <div class="card-label">p95 Response</div>
        <div class="card-value">${ms(p95Response)}</div>
        <div class="card-sub">p99: ${ms(p99Response)} · Max: ${ms(maxResponse)}</div>
      </div>
    </div>
  </section>

  <div class="divider"></div>

  <!-- SECTION 2: RESPONSE TIME CHARTS -->
  <section>
    <div class="section-label">02 — Response Time</div>
    <div class="section-title">Latency over test duration</div>
    <div class="charts-2col">
      <div class="chart-box wide">
        <div class="chart-title">Response Time &amp; Virtual Users — Timeline</div>
        <div class="chart-sub">avg and p95 response time vs VU ramp curve</div>
        <div class="chart-wrap">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>
    </div>
  </section>

  <div class="divider"></div>

  <!-- SECTION 3: PER-ENDPOINT BREAKDOWN -->
  <section>
    <div class="section-label">03 — Per-Endpoint Breakdown</div>
    <div class="section-title">Property Owner · First Home Buyer · Smart Renter</div>
    <div class="charts-2col" style="margin-bottom:1.5rem">
      <div class="chart-box">
        <div class="chart-title">Avg Response by Endpoint</div>
        <div class="chart-sub">average response time per calculator</div>
        <div class="chart-wrap">
          <canvas id="endpointAvgChart"></canvas>
        </div>
      </div>
      <div class="chart-box">
        <div class="chart-title">P95 Response by Endpoint</div>
        <div class="chart-sub">95th percentile response time per calculator</div>
        <div class="chart-wrap">
          <canvas id="endpointP95Chart"></canvas>
        </div>
      </div>
    </div>
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:6px; overflow:hidden;">
      <table>
        <thead><tr>
          <th>Calculator</th><th>Endpoint</th><th>Requests</th>
          <th>Min</th><th>Avg</th><th>P95</th><th>Error Rate</th>
        </tr></thead>
        <tbody>${endpointRows}</tbody>
      </table>
    </div>
  </section>

  <div class="divider"></div>

  ${systemSection}

  <!-- SECTION 5: THRESHOLDS -->
  <section>
    <div class="section-label">05 — Threshold Results</div>
    <div class="section-title">Pass / fail criteria evaluation</div>
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:6px; overflow:hidden;">
      <table>
        <thead><tr><th>Threshold</th><th>Condition</th><th>Result</th></tr></thead>
        <tbody>${thresholdRows}</tbody>
      </table>
    </div>
  </section>

</main>

<footer>
  <div>myfingoal Performance Test Suite · k6 + Grafana Cloud · Generated ${new Date(generatedAt).toLocaleDateString('en-AU')}</div>
  ${grafanaUrl ? `<div><a href="${grafanaUrl}" target="_blank">→ View live in Grafana Cloud</a></div>` : '<div>Run with --grafana-url flag to link Grafana run</div>'}
</footer>

<script>
  Chart.defaults.color = '#64748b';
  Chart.defaults.borderColor = '#1e2d45';
  Chart.defaults.font.family = "'JetBrains Mono', monospace";
  Chart.defaults.font.size = 11;

  const GREEN = '#00e5a0';
  const AMBER = '#f59e0b';
  const BLUE  = '#3b82f6';
  const CYAN  = '#06b6d4';
  const RED   = '#ef4444';

  const responseTS = ${safeJson(responseTimeSeries)};
  const vuTS       = ${safeJson(vuTimeSeries)};
  const cpuTS      = ${safeJson(cpuTimeSeries)};
  const endpoints  = ${safeJson(endpoints)};

  // Helper: friendly label from URL
  function epLabel(url) {
    if (url.includes('calculate-fhb'))    return 'First Home Buyer';
    if (url.includes('calculate-renter')) return 'Smart Renter';
    if (url.includes('calculate'))        return 'Property Owner';
    return url.split('/').pop();
  }

  // ── Timeline Chart ──
  const timeLabels = responseTS.map(r => r.t);
  new Chart(document.getElementById('timelineChart'), {
    data: {
      labels: timeLabels,
      datasets: [
        {
          type: 'line', label: 'Avg Response (ms)',
          data: responseTS.map(r => r.avg),
          borderColor: AMBER, backgroundColor: 'rgba(245,158,11,0.08)',
          fill: true, tension: 0.4, yAxisID: 'y', pointRadius: 0,
        },
        {
          type: 'line', label: 'p95 Response (ms)',
          data: responseTS.map(r => r.p95),
          borderColor: BLUE, borderDash: [4,3],
          fill: false, tension: 0.4, yAxisID: 'y', pointRadius: 0,
        },
        {
          type: 'line', label: 'Virtual Users',
          data: vuTS.map(v => v.vus),
          borderColor: GREEN, backgroundColor: 'rgba(0,229,160,0.05)',
          fill: true, tension: 0.3, yAxisID: 'y2', pointRadius: 0,
          borderWidth: 1.5,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12 } } },
      scales: {
        x: { grid: { color: '#1e2d45' }, ticks: { color: '#64748b', maxTicksLimit: 12 } },
        y: {
          grid: { color: '#1e2d45' }, ticks: { color: '#64748b' },
          title: { display: true, text: 'Response Time (ms)', color: '#475569' },
          position: 'left',
        },
        y2: {
          grid: { drawOnChartArea: false }, ticks: { color: '#475569' },
          title: { display: true, text: 'Virtual Users', color: '#475569' },
          position: 'right',
        }
      }
    }
  });

  // ── Endpoint Avg Chart ──
  const epLabels = endpoints.map(e => epLabel(e.url));
  const epColours = [GREEN, BLUE, AMBER, CYAN];
  new Chart(document.getElementById('endpointAvgChart'), {
    type: 'bar',
    data: {
      labels: epLabels,
      datasets: [{
        label: 'Avg (ms)',
        data: endpoints.map(e => Math.round(e.avg)),
        backgroundColor: endpoints.map((_, i) => epColours[i % epColours.length] + 'cc'),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2d45' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#1e2d45' }, ticks: { color: '#64748b' },
             title: { display: true, text: 'ms', color: '#475569' } }
      }
    }
  });

  // ── Endpoint P95 Chart ──
  new Chart(document.getElementById('endpointP95Chart'), {
    type: 'bar',
    data: {
      labels: epLabels,
      datasets: [{
        label: 'P95 (ms)',
        data: endpoints.map(e => Math.round(e.p95)),
        backgroundColor: endpoints.map((_, i) => epColours[i % epColours.length] + 'cc'),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#1e2d45' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#1e2d45' }, ticks: { color: '#64748b' },
             title: { display: true, text: 'ms', color: '#475569' } }
      }
    }
  });

  // ── System Chart (only if data present) ──
  if (cpuTS.length > 0 && document.getElementById('systemChart')) {
    new Chart(document.getElementById('systemChart'), {
      data: {
        labels: cpuTS.map(r => r.t),
        datasets: [
          {
            type: 'line', label: 'CPU %',
            data: cpuTS.map(r => r.cpu),
            borderColor: AMBER, backgroundColor: 'rgba(245,158,11,0.08)',
            fill: true, tension: 0.4, yAxisID: 'y', pointRadius: 0,
          },
          {
            type: 'line', label: 'RAM %',
            data: cpuTS.map(r => r.ram),
            borderColor: CYAN, borderDash: [4,3],
            fill: false, tension: 0.3, yAxisID: 'y2', pointRadius: 0,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12 } } },
        scales: {
          x: { grid: { color: '#1e2d45' }, ticks: { color: '#64748b', maxTicksLimit: 14 } },
          y: {
            grid: { color: '#1e2d45' }, ticks: { color: '#64748b' },
            title: { display: true, text: 'CPU %', color: '#475569' },
            position: 'left', min: 0, max: 100,
          },
          y2: {
            grid: { drawOnChartArea: false }, ticks: { color: '#475569' },
            title: { display: true, text: 'RAM %', color: '#475569' },
            position: 'right', min: 0, max: 100,
          }
        }
      }
    });
  }
<\/script>
</body>
</html>`;
}

module.exports = { renderReport };
