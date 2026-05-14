// Shared pass/fail criteria used across all test scripts.
// Keeping them here means you change them once and all tests update.

export const standardThresholds = {
  // No more than 1% of requests can fail
  http_req_failed: ["rate<0.01"],

  // 95% of requests must complete under 2 seconds
  // 99% of requests must complete under 5 seconds
  http_req_duration: ["p(95)<2000", "p(99)<5000"],
};

export const smokeThresholds = {
  http_req_failed: ["rate==0"],
  http_req_duration: ["p(95)<5000"],
};