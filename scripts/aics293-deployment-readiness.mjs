#!/usr/bin/env node

const REQUIRED_BASE_URL = "AICS293_BASE_URL";

const env = process.env;

const redact = (value) => {
  if (!value) {
    return "";
  }

  if (value.length <= 12) {
    return "<redacted>";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const baseUrl = (env[REQUIRED_BASE_URL] || "").replace(/\/+$/, "");

if (!baseUrl) {
  console.error(`Missing ${REQUIRED_BASE_URL}. Example:`);
  console.error(`${REQUIRED_BASE_URL}=http://127.0.0.1:9000 node scripts/aics293-deployment-readiness.mjs`);
  process.exit(2);
}

const publishableKey = env.AICS293_PUBLISHABLE_API_KEY || "";
const buyerBearer = env.AICS293_BUYER_BEARER || "";
const adminBearer = env.AICS293_ADMIN_BEARER || "";
const vendorBearer = env.AICS293_VENDOR_BEARER || "";

const checks = [
  {
    id: "health",
    method: "GET",
    path: "/health",
    required: true,
    expectStatus: [200],
  },
  {
    id: "buyer_role_list",
    method: "GET",
    path: "/dijie/roles",
    required: true,
    expectStatus: [200],
    publishable: true,
  },
  {
    id: "buyer_my_roles",
    method: "GET",
    path: "/dijie/my-roles",
    required: Boolean(buyerBearer),
    skipReason: buyerBearer ? "" : "missing AICS293_BUYER_BEARER",
    expectStatus: [200],
    bearer: buyerBearer,
  },
  {
    id: "vendor_receivables",
    method: "GET",
    path: "/vendor/dijie/receivables",
    required: Boolean(vendorBearer),
    skipReason: vendorBearer ? "" : "missing AICS293_VENDOR_BEARER",
    expectStatus: [200],
    bearer: vendorBearer,
  },
];

const buildHeaders = (check) => {
  const headers = {
    accept: "application/json",
  };

  if (check.publishable && publishableKey) {
    headers["x-publishable-api-key"] = publishableKey;
  }

  if (check.bearer) {
    headers.authorization = `Bearer ${check.bearer}`;
  }

  return headers;
};

const readBodyPreview = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!text) {
    return "";
  }

  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(text);
      return JSON.stringify(json).slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  }

  return text.replace(/\s+/g, " ").slice(0, 240);
};

const runCheck = async (check) => {
  if (!check.required) {
    return {
      id: check.id,
      path: check.path,
      status: "skipped",
      reason: check.skipReason,
    };
  }

  const url = `${baseUrl}${check.path}`;
  const headers = buildHeaders(check);
  const response = await fetch(url, {
    method: check.method,
    headers,
  });
  const bodyPreview = await readBodyPreview(response);
  const ok = check.expectStatus.includes(response.status);

  return {
    id: check.id,
    path: check.path,
    status: ok ? "passed" : "failed",
    httpStatus: response.status,
    expected: check.expectStatus,
    bodyPreview,
  };
};

const main = async () => {
  const results = [];

  for (const check of checks) {
    try {
      results.push(await runCheck(check));
    } catch (error) {
      results.push({
        id: check.id,
        path: check.path,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failed = results.filter((result) => result.status === "failed");
  const skipped = results.filter((result) => result.status === "skipped");

  const report = {
    baseUrl,
    credentials: {
      publishableKey: redact(publishableKey),
      buyerBearer: buyerBearer ? "<provided>" : "<missing>",
      adminBearer: adminBearer ? "<provided>" : "<missing>",
      vendorBearer: vendorBearer ? "<provided>" : "<missing>",
    },
    summary: {
      passed: results.filter((result) => result.status === "passed").length,
      failed: failed.length,
      skipped: skipped.length,
    },
    results,
  };

  console.log(JSON.stringify(report, null, 2));

  if (failed.length > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
