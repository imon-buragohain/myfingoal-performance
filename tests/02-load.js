import http from "k6/http";
import { check, sleep } from "k6";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

import { poPayload } from "../payloads/po-payload.js";
import { fhbPayload } from "../payloads/fhb-payload.js";
import { renterPayload } from "../payloads/renter-payload.js";
import { standardThresholds } from "../config/thresholds.js";

// Load test: simulates realistic concurrent usage.
// Ramps to 20 VUs over 1 min, holds for 2 mins, ramps down over 1 min.
// Each VU loops continuously through all 3 endpoints.
// Purpose: confirm the API maintains acceptable response times
// under expected normal traffic levels.
export const options = {
  stages: [
    { duration: "1m", target: 20 },   // ramp up to 20 users
    { duration: "2m", target: 20 },   // hold at 20 users
    { duration: "1m", target: 0  },   // ramp back down
  ],
  thresholds: standardThresholds,
};

const BASE_URL = "http://localhost:8000";
const headers = { "Content-Type": "application/json" };

export default function () {
  // Each VU picks one endpoint per iteration based on a weighted distribution.
  // PO is heaviest calculation so we weight it lower — reflects realistic usage.
  const rand = Math.random();

  if (rand < 0.5) {
    // 50% of requests go to PO (most complex calculation)
    const res = http.post(
      `${BASE_URL}/api/calculate`,
      JSON.stringify(poPayload),
      { headers, tags: { endpoint: "po" } }
    );
    check(res, {
      "PO: status 200": (r) => r.status === 200,
      "PO: under 2s":   (r) => r.timings.duration < 2000,
    });

  } else if (rand < 0.80) {
    // 30% of requests go to FHB
    const res = http.post(
      `${BASE_URL}/api/calculate-fhb`,
      JSON.stringify(fhbPayload),
      { headers, tags: { endpoint: "fhb" } }
    );
    check(res, {
      "FHB: status 200": (r) => r.status === 200,
      "FHB: under 2s":   (r) => r.timings.duration < 2000,
    });

  } else {
    // 20% of requests go to SR
    const res = http.post(
      `${BASE_URL}/api/calculate-renter`,
      JSON.stringify(renterPayload),
      { headers, tags: { endpoint: "sr" } }
    );
    check(res, {
      "SR: status 200": (r) => r.status === 200,
      "SR: under 2s":   (r) => r.timings.duration < 2000,
    });
  }

  // Think time between requests — simulates a user reading results
  // before recalculating. Keeps load realistic, not a hammer.
  sleep(Math.random() * 2 + 1); // random 1–3 seconds
}

export function handleSummary(data) {
  return {
    "reports/load-latest.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}