import http from "k6/http";
import { check, sleep } from "k6";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

import { poPayload } from "../payloads/po-payload.js";
import { fhbPayload } from "../payloads/fhb-payload.js";
import { renterPayload } from "../payloads/renter-payload.js";

// Smoke test: 1 virtual user, runs once through all 3 endpoints.
// Purpose: confirm the API is alive and returning valid responses
// before running any heavier tests.
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ["rate==0"],         // zero failures required
    http_req_duration: ["p(95)<5000"],    // 95th percentile under 5s (generous for smoke)
  },
};

const BASE_URL = "http://localhost:8000";

const headers = { "Content-Type": "application/json" };

export default function () {
  // --- PO stream ---
  const poRes = http.post(
    `${BASE_URL}/api/calculate`,
    JSON.stringify(poPayload),
    { headers }
  );
  check(poRes, {
    "PO: status 200":        (r) => r.status === 200,
    "PO: has retirement_simulation": (r) => JSON.parse(r.body).retirement_simulation !== undefined,
    "PO: response under 3s": (r) => r.timings.duration < 3000,
  });

  sleep(1);

  // --- FHB stream ---
  const fhbRes = http.post(
  `${BASE_URL}/api/calculate-fhb`,
  JSON.stringify(fhbPayload),
  { headers }
);

  sleep(1);

  // --- SR stream ---
  const srRes = http.post(
    `${BASE_URL}/api/calculate-renter`,
    JSON.stringify(renterPayload),
    { headers }
  );
  check(srRes, {
    "SR: status 200":        (r) => r.status === 200,
    "SR: has rent_projection":(r) => JSON.parse(r.body).rent_projection !== undefined,
    "SR: response under 3s": (r) => r.timings.duration < 3000,
  });

  sleep(1);
}

// This runs after the test finishes and generates the HTML report
export function handleSummary(data) {
  return {
    "reports/smoke-latest.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}