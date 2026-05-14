import http from "k6/http";
import { check, sleep } from "k6";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

import { poPayload } from "../payloads/po-payload.js";
import { fhbPayload } from "../payloads/fhb-payload.js";
import { renterPayload } from "../payloads/renter-payload.js";

// Stress test: pushes beyond expected load to find the breaking point.
// Ramps aggressively to 100 VUs in stages.
//  Degradation expected at some point — the goal is to find where,
// and confirm the system recovers when load drops back.
// Thresholds are deliberately more lenient — goal is to observe,
// not just pass/fail at the same bar as the load test.
export const options = {
    ext: {
    loadimpact: {
      name: "myfingoal — Stress Test",
    },
  },
    stages: [
    { duration: "2m", target: 20  },  // warm up at normal load
    { duration: "2m", target: 40  },  // push to 2x normal
    { duration: "2m", target: 60  },  // push to 3x normal
    { duration: "2m", target: 80  },  // push to 4x normal
    { duration: "2m", target: 100 },  // push to 5x normal — likely breaking zone
    { duration: "2m", target: 20  },  // recovery — does it come back?
    { duration: "1m", target: 0   },  // ramp down
  ],
  thresholds: {
    // Reduced thresholds to allow for expected degradation under stress
    http_req_failed:   ["rate<0.10"],   // allow up to 10% errors
    http_req_duration: ["p(95)<10000"], // allow up to 10s p95
  },
};

const BASE_URL = "http://localhost:8000";
const headers = { "Content-Type": "application/json" };

export default function () {
  const rand = Math.random();

  if (rand < 0.5) {
    const res = http.post(
      `${BASE_URL}/api/calculate`,
      JSON.stringify(poPayload),
      { headers, tags: { endpoint: "po" } }
    );
    check(res, {
      "PO: status 200": (r) => r.status === 200,
      "PO: under 5s":   (r) => r.timings.duration < 5000,
    });

  } else if (rand < 0.80) {
    const res = http.post(
      `${BASE_URL}/api/calculate-fhb`,
      JSON.stringify(fhbPayload),
      { headers, tags: { endpoint: "fhb" } }
    );
    check(res, {
      "FHB: status 200": (r) => r.status === 200,
      "FHB: under 5s":   (r) => r.timings.duration < 5000,
    });

  } else {
    const res = http.post(
      `${BASE_URL}/api/calculate-renter`,
      JSON.stringify(renterPayload),
      { headers, tags: { endpoint: "sr" } }
    );
    check(res, {
      "SR: status 200": (r) => r.status === 200,
      "SR: under 5s":   (r) => r.timings.duration < 5000,
    });
  }

  // Shorter think time than load test
  sleep(Math.random() * 1 + 0.5); // random 0.5–1.5 seconds
}

export function handleSummary(data) {
  return {
    "reports/stress-latest.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}