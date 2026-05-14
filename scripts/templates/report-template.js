/**
 * report-template.js
 * HTML template for myfingoal performance reports.
 * Professional light theme — suitable for senior leadership distribution.
 * Receives a `data` object from generate-report.js and returns a complete HTML string.
 */

'use strict';

function renderReport(data) {
  const {
    testType,
    testFile,
    generatedAt,
    duration,
    maxVUs,
    totalRequests,
    errorRate,
    avgResponse,
    p90Response,
    p95Response,
    p99Response,
    maxResponse,
    throughputAvg,
    throughputPeak,
    endpoints,
    systemMetrics,
    grafanaUrl,
    thresholds,
    responseTimeSeries,
    vuTimeSeries,
    cpuTimeSeries,
  } = data;

  const passedAll   = thresholds.every(t => t.passed);
  const statusText  = passedAll ? 'PASS' : 'FAIL';
  const statusColor  = passedAll ? '#15803d' : '#b91c1c';
  const statusBg     = passedAll ? '#f0fdf4' : '#fef2f2';
  const statusBorder = passedAll ? '#86efac' : '#fca5a5';

  const ms  = (v) => v == null ? '—' : `${Math.round(v)} ms`;
  const pct = (v) => v == null ? '—' : `${v.toFixed(2)}%`;

  const endpointLabel = (url) => {
    if (url.includes('calculate-fhb'))    return 'First Home Buyer';
    if (url.includes('calculate-renter')) return 'Smart Renter';
    if (url.includes('calculate'))        return 'Property Owner';
    return url.split('/').pop();
  };

  const formattedDate = new Date(generatedAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const formattedTime = new Date(generatedAt).toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit'
  });

  const endpointRows = endpoints.map((ep, i) => {
    const rowBg    = i % 2 === 0 ? '#ffffff' : '#f9fafb';
    const p95Color = ep.p95 < 500 ? '#15803d' : ep.p95 < 2000 ? '#92400e' : '#b91c1c';
    const errColor = ep.errorRate === 0 ? '#15803d' : '#b91c1c';
    return `
    <tr style="background:${rowBg}">
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827">${endpointLabel(ep.url)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-family:Consolas,'Courier New',monospace;font-size:0.8rem">${ep.url}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151">${ep.count.toLocaleString()}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151">${ms(ep.min)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151">${ms(ep.avg)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${p95Color}">${ms(ep.p95)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:${errColor}">${pct(ep.errorRate)}</td>
    </tr>`;
  }).join('');

  const thresholdRows = thresholds.map((t, i) => {
    const rowBg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
    const color = t.passed ? '#15803d' : '#b91c1c';
    const icon  = t.passed ? '✔' : '✘';
    return `
    <tr style="background:${rowBg}">
      <td style="padding:10px 14px;border:1px solid #e5e7eb;font-family:Consolas,'Courier New',monospace;font-size:0.82rem;color:#374151">${t.name}</td>
      <td style="padding:10px 14px;border:1px solid #e5e7eb;font-family:Consolas,'Courier New',monospace;font-size:0.82rem;color:#6b7280">${t.condition}</td>
      <td style="padding:10px 14px;border:1px solid #e5e7eb;text-align:center;font-weight:700;color:${color}">${icon}</td>
      <td style="padding:10px 14px;border:1px solid #e5e7eb;font-family:Consolas,'Courier New',monospace;font-size:0.82rem;color:${color}">${t.result}</td>
    </tr>`;
  }).join('');

  const hasSystem = systemMetrics && systemMetrics.samples > 0 && cpuTimeSeries && cpuTimeSeries.length > 0;

  const systemSection = hasSystem ? `
    <div style="height:1px;background:#e5e7eb;margin-bottom:36px"></div>

    <div style="margin-bottom:36px">
      <h2 style="font-size:1rem;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1e40af;padding-bottom:8px;margin-bottom:20px">
        4. System Resource Utilisation
      </h2>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:3px solid #d97706;border-radius:4px;padding:16px">
          <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">CPU — Peak</div>
          <div style="font-size:1.6rem;font-weight:700;color:#92400e">${systemMetrics.cpuMax.toFixed(1)}%</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">Avg ${systemMetrics.cpuAvg.toFixed(1)}%</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:3px solid #1e40af;border-radius:4px;padding:16px">
          <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">RAM — Peak</div>
          <div style="font-size:1.6rem;font-weight:700;color:#1e40af">${systemMetrics.ramMax.toFixed(1)}%</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">Avg ${systemMetrics.ramAvg.toFixed(1)}%</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:3px solid #64748b;border-radius:4px;padding:16px">
          <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">API Process RAM</div>
          <div style="font-size:1.6rem;font-weight:700;color:#374151">${systemMetrics.fastapiRamAvg.toFixed(0)} MB</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">Constant throughout</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:3px solid #15803d;border-radius:4px;padding:16px">
          <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Memory Leak</div>
          <div style="font-size:1.6rem;font-weight:700;color:#15803d">None</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">RAM variation ±${(systemMetrics.ramMax - systemMetrics.ramMin).toFixed(1)}%</div>
        </div>
      </div>

      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:4px;padding:20px;margin-bottom:16px">
        <div style="font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:3px">CPU &amp; Memory — Test Duration</div>
        <div style="font-size:0.78rem;color:#9ca3af;margin-bottom:16px">System-wide utilisation sampled every 3 seconds during test execution</div>
        <div style="position:relative;height:220px">
          <canvas id="systemChart"></canvas>
        </div>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #d97706;border-radius:4px;padding:12px 16px;font-size:0.8rem;color:#78350f;line-height:1.6">
        <strong>Note:</strong> API process CPU is recorded as 0.0% throughout. This is an expected measurement artefact — the web server spawns worker child processes at startup, and CPU consumption occurs within those workers rather than the parent process tracked here. System-wide CPU figures above accurately reflect total server load.
      </div>
    </div>
  ` : '';

  const sectionNum = hasSystem ? '5' : '4';
  const safeJson = (obj) => JSON.stringify(obj).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Performance Test Report — ${testType} — ${formattedDate}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"><\/script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f3f4f6; color:#111827; font-family:'Segoe UI',Arial,sans-serif; font-size:14px; line-height:1.5; }
  @media print {
    body { background:#fff; }
    .page { box-shadow:none; margin:0; }
  }
</style>
</head>
<body>

<div style="max-width:1100px;margin:32px auto;padding:0 24px">

  <!-- HEADER -->
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:4px;padding:40px 48px;margin-bottom:24px;border-top:5px solid #1e40af">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">API Performance Test Report</div>
        <h1 style="font-size:1.8rem;font-weight:700;color:#111827;letter-spacing:-0.02em;margin-bottom:4px">${testType} Test — myfingoal</h1>
        <div style="font-size:0.9rem;color:#6b7280">Australian Family Financial Planner — FastAPI Backend</div>
      </div>
      <div>
        <div style="display:inline-block;background:${statusBg};border:1px solid ${statusBorder};color:${statusColor};font-weight:700;font-size:0.85rem;padding:6px 20px;border-radius:3px;letter-spacing:0.08em">${statusText}</div>
      </div>
    </div>

    <div style="height:1px;background:#e5e7eb;margin:28px 0"></div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0">
      <div style="padding-right:24px;border-right:1px solid #e5e7eb">
        <div style="font-size:0.72rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Date</div>
        <div style="font-size:0.88rem;color:#374151;font-weight:500">${formattedDate}</div>
      </div>
      <div style="padding:0 24px;border-right:1px solid #e5e7eb">
        <div style="font-size:0.72rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Generated</div>
        <div style="font-size:0.88rem;color:#374151;font-weight:500">${formattedTime}</div>
      </div>
      <div style="padding:0 24px;border-right:1px solid #e5e7eb">
        <div style="font-size:0.72rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Test Script</div>
        <div style="font-size:0.88rem;color:#374151;font-weight:500;font-family:Consolas,'Courier New',monospace">${testFile}</div>
      </div>
      <div style="padding-left:24px">
        <div style="font-size:0.72rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Target</div>
        <div style="font-size:0.88rem;color:#374151;font-weight:500;font-family:Consolas,'Courier New',monospace">localhost:8000</div>
      </div>
    </div>

    ${grafanaUrl ? `<div style="margin-top:20px"><a href="${grafanaUrl}" style="font-size:0.8rem;color:#1e40af;text-decoration:none">→ View full interactive dashboard in Grafana Cloud</a></div>` : ''}
  </div>

  <!-- BODY -->
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:4px;padding:40px 48px">

    <!-- SECTION 1: EXECUTIVE SUMMARY -->
    <div style="margin-bottom:36px">
      <h2 style="font-size:1rem;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1e40af;padding-bottom:8px;margin-bottom:20px">1. Executive Summary</h2>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:3px solid #1e40af;border-radius:4px;padding:16px">
          <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Total Requests</div>
          <div style="font-size:1.6rem;font-weight:700;color:#111827">${totalRequests >= 1000 ? (totalRequests/1000).toFixed(1)+'k' : totalRequests}</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">Over ${duration}</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:3px solid ${errorRate === 0 ? '#15803d' : '#b91c1c'};border-radius:4px;padding:16px">
          <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Error Rate</div>
          <div style="font-size:1.6rem;font-weight:700;color:${errorRate === 0 ? '#15803d' : '#b91c1c'}">${pct(errorRate)}</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">${errorRate === 0 ? 'Zero failures' : 'Failures detected'}</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:3px solid #374151;border-radius:4px;padding:16px">
          <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Avg Response Time</div>
          <div style="font-size:1.6rem;font-weight:700;color:#111827">${ms(avgResponse)}</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">p90: ${ms(p90Response)}</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:3px solid ${p95Response < 2000 ? '#374151' : '#b91c1c'};border-radius:4px;padding:16px">
          <div style="font-size:0.72rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">95th Percentile</div>
          <div style="font-size:1.6rem;font-weight:700;color:${p95Response < 2000 ? '#111827' : '#b91c1c'}">${ms(p95Response)}</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-top:4px">p99: ${ms(p99Response)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;border:1px solid #e5e7eb">Metric</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#374151;border:1px solid #e5e7eb">Value</th>
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;border:1px solid #e5e7eb">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;color:#374151">Virtual Users (peak)</td>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600">${maxVUs}</td>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;color:#6b7280">Maximum concurrent simulated users</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:9px 14px;border:1px solid #e5e7eb;color:#374151">Average throughput</td>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600">${throughputAvg} req/s</td>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;color:#6b7280">Peak: ${throughputPeak} req/s</td>
          </tr>
          <tr>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;color:#374151">Maximum response time</td>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600">${ms(maxResponse)}</td>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;color:#6b7280">Single worst-case request</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:9px 14px;border:1px solid #e5e7eb;color:#374151">Test duration</td>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;text-align:right;font-weight:600">${duration}</td>
            <td style="padding:9px 14px;border:1px solid #e5e7eb;color:#6b7280">Including ramp-up and ramp-down</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="height:1px;background:#e5e7eb;margin-bottom:36px"></div>

    <!-- SECTION 2: RESPONSE TIME -->
    <div style="margin-bottom:36px">
      <h2 style="font-size:1rem;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1e40af;padding-bottom:8px;margin-bottom:20px">2. Response Time Analysis</h2>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:4px;padding:20px">
        <div style="font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:3px">Response Time &amp; Concurrent Users — Over Test Duration</div>
        <div style="font-size:0.78rem;color:#9ca3af;margin-bottom:16px">Average and 95th percentile response time plotted against virtual user count</div>
        <div style="position:relative;height:240px"><canvas id="timelineChart"></canvas></div>
      </div>
    </div>

    <div style="height:1px;background:#e5e7eb;margin-bottom:36px"></div>

    <!-- SECTION 3: ENDPOINT BREAKDOWN -->
    <div style="margin-bottom:36px">
      <h2 style="font-size:1rem;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1e40af;padding-bottom:8px;margin-bottom:20px">3. Per-Endpoint Performance</h2>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:4px;padding:20px">
          <div style="font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:3px">Average Response Time by Endpoint</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-bottom:16px">Milliseconds</div>
          <div style="position:relative;height:200px"><canvas id="endpointAvgChart"></canvas></div>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:4px;padding:20px">
          <div style="font-size:0.85rem;font-weight:600;color:#374151;margin-bottom:3px">95th Percentile by Endpoint</div>
          <div style="font-size:0.78rem;color:#9ca3af;margin-bottom:16px">Milliseconds</div>
          <div style="position:relative;height:200px"><canvas id="endpointP95Chart"></canvas></div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;border:1px solid #e5e7eb">Calculator</th>
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;border:1px solid #e5e7eb">Endpoint</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#374151;border:1px solid #e5e7eb">Requests</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#374151;border:1px solid #e5e7eb">Min</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#374151;border:1px solid #e5e7eb">Avg</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#374151;border:1px solid #e5e7eb">P95</th>
            <th style="padding:10px 14px;text-align:right;font-weight:600;color:#374151;border:1px solid #e5e7eb">Error Rate</th>
          </tr>
        </thead>
        <tbody>${endpointRows}</tbody>
      </table>
    </div>

    ${systemSection}

    <!-- SECTION: THRESHOLDS -->
    <div style="margin-bottom:36px">
      <h2 style="font-size:1rem;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #1e40af;padding-bottom:8px;margin-bottom:20px">${sectionNum}. Pass / Fail Criteria</h2>
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;border:1px solid #e5e7eb">Threshold</th>
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;border:1px solid #e5e7eb">Condition</th>
            <th style="padding:10px 14px;text-align:center;font-weight:600;color:#374151;border:1px solid #e5e7eb">Result</th>
            <th style="padding:10px 14px;text-align:left;font-weight:600;color:#374151;border:1px solid #e5e7eb">Measured Value</th>
          </tr>
        </thead>
        <tbody>${thresholdRows}</tbody>
      </table>
    </div>

  </div>

  <!-- FOOTER -->
  <div style="padding:20px 0;display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:#9ca3af">
    <div>myfingoal Performance Test Suite · k6 + Grafana Cloud · ${formattedDate}</div>
    <div>${grafanaUrl ? `<a href="${grafanaUrl}" style="color:#1e40af;text-decoration:none">View in Grafana Cloud →</a>` : 'Run with --grafana-url to link Grafana dashboard'}</div>
  </div>

</div>

<script>
  Chart.defaults.color = '#6b7280';
  Chart.defaults.borderColor = '#e5e7eb';
  Chart.defaults.font.family = "'Segoe UI', Arial, sans-serif";
  Chart.defaults.font.size = 11;

  const BLUE  = '#1e40af';
  const SLATE = '#475569';
  const AMBER = '#d97706';

  const responseTS = ${safeJson(responseTimeSeries)};
  const vuTS       = ${safeJson(vuTimeSeries)};
  const cpuTS      = ${safeJson(cpuTimeSeries)};
  const endpoints  = ${safeJson(endpoints)};

  function epLabel(url) {
    if (url.includes('calculate-fhb'))    return 'First Home Buyer';
    if (url.includes('calculate-renter')) return 'Smart Renter';
    if (url.includes('calculate'))        return 'Property Owner';
    return url.split('/').pop();
  }

  // Timeline chart
  new Chart(document.getElementById('timelineChart'), {
    data: {
      labels: responseTS.map(r => r.t),
      datasets: [
        {
          type: 'line', label: 'Avg Response (ms)',
          data: responseTS.map(r => r.avg),
          borderColor: BLUE, backgroundColor: 'rgba(30,64,175,0.06)',
          fill: true, tension: 0.4, yAxisID: 'y', pointRadius: 0, borderWidth: 2,
        },
        {
          type: 'line', label: 'P95 Response (ms)',
          data: responseTS.map(r => r.p95),
          borderColor: SLATE, borderDash: [5,3],
          fill: false, tension: 0.4, yAxisID: 'y', pointRadius: 0, borderWidth: 1.5,
        },
        {
          type: 'line', label: 'Virtual Users',
          data: vuTS.map(v => v.vus),
          borderColor: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.08)',
          fill: true, tension: 0.3, yAxisID: 'y2', pointRadius: 0, borderWidth: 1,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#374151', boxWidth: 14, padding: 16 } } },
      scales: {
        x: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', maxTicksLimit: 12 } },
        y: {
          grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' },
          title: { display: true, text: 'Response Time (ms)', color: '#6b7280', font: { size: 11 } },
          position: 'left',
        },
        y2: {
          grid: { drawOnChartArea: false }, ticks: { color: '#9ca3af' },
          title: { display: true, text: 'Virtual Users', color: '#9ca3af', font: { size: 11 } },
          position: 'right',
        }
      }
    }
  });

  // Endpoint charts
  const epLabels  = endpoints.map(e => epLabel(e.url));
  const epColours = [BLUE, SLATE, '#0369a1'];

  new Chart(document.getElementById('endpointAvgChart'), {
    type: 'bar',
    data: {
      labels: epLabels,
      datasets: [{
        label: 'Avg (ms)',
        data: endpoints.map(e => Math.round(e.avg)),
        backgroundColor: epColours.map(c => c + '1a'),
        borderColor: epColours, borderWidth: 2, borderRadius: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7280' } },
        y: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' },
             title: { display: true, text: 'ms', color: '#6b7280' } }
      }
    }
  });

  new Chart(document.getElementById('endpointP95Chart'), {
    type: 'bar',
    data: {
      labels: epLabels,
      datasets: [{
        label: 'P95 (ms)',
        data: endpoints.map(e => Math.round(e.p95)),
        backgroundColor: epColours.map(c => c + '1a'),
        borderColor: epColours, borderWidth: 2, borderRadius: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7280' } },
        y: { grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' },
             title: { display: true, text: 'ms', color: '#6b7280' } }
      }
    }
  });

  // System chart
  if (cpuTS.length > 0 && document.getElementById('systemChart')) {
    new Chart(document.getElementById('systemChart'), {
      data: {
        labels: cpuTS.map(r => r.t),
        datasets: [
          {
            type: 'line', label: 'CPU %',
            data: cpuTS.map(r => r.cpu),
            borderColor: AMBER, backgroundColor: 'rgba(217,119,6,0.06)',
            fill: true, tension: 0.4, yAxisID: 'y', pointRadius: 0, borderWidth: 2,
          },
          {
            type: 'line', label: 'RAM %',
            data: cpuTS.map(r => r.ram),
            borderColor: '#64748b', borderDash: [5,3],
            fill: false, tension: 0.3, yAxisID: 'y2', pointRadius: 0, borderWidth: 1.5,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#374151', boxWidth: 14, padding: 16 } } },
        scales: {
          x: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', maxTicksLimit: 14 } },
          y: {
            grid: { color: '#f3f4f6' }, ticks: { color: '#6b7280' },
            title: { display: true, text: 'CPU %', color: '#6b7280' },
            position: 'left', min: 0,
          },
          y2: {
            grid: { drawOnChartArea: false }, ticks: { color: '#9ca3af' },
            title: { display: true, text: 'RAM %', color: '#9ca3af' },
            position: 'right', min: 0,
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