#!/usr/bin/env node

const REQUIRED_BASE_URL = "AICS293_BASE_URL";
const REQUIRED_VENDOR_BEARER = "AICS293_VENDOR_BEARER";

const env = process.env;

const baseUrl = (env[REQUIRED_BASE_URL] || "").replace(/\/+$/, "");
const vendorBearer = env[REQUIRED_VENDOR_BEARER] || "";
const sellerId = env.AICS293_SELLER_ID || "";
const prompt =
  env.AICS293_DEVELOPER_ROLE_PROMPT ||
  [
    "我要做一个智能门锁电商美工岗位。",
    "它负责主图、详情页、海报、店铺视觉维护、日常巡检、产品图保真自检、问题记录和设计标准维护。",
    "请生成完整 role_package，包含 manifest.json、README.md、listing.md、tool_requirements.md、skills、knowledge、templates、validation，并解析 requiredCapabilities。",
  ].join("\n");

if (!baseUrl || !vendorBearer) {
  console.error("Missing required environment. Example:");
  console.error(
    `${REQUIRED_BASE_URL}=http://127.0.0.1:9000 ${REQUIRED_VENDOR_BEARER}=<vendor-bearer> AICS293_SELLER_ID=<seller-id> node scripts/aics293-developer-generation-preflight.mjs`,
  );
  process.exit(2);
}

const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const summarizeCapabilityReport = (report) => {
  const results = asArray(asObject(report).results);
  const counts = {};
  for (const item of results) {
    const status = asObject(item).status || "unknown";
    counts[status] = (counts[status] || 0) + 1;
  }
  return {
    ok: Boolean(asObject(report).ok),
    counts,
    blockedReasons: asArray(asObject(report).blockedReasons),
  };
};

const summarizeModelUsage = (usage) => {
  const modelUsage = asObject(usage);
  const pricing = asObject(modelUsage.pricing);
  return {
    provider: modelUsage.provider ?? null,
    model: modelUsage.model ?? null,
    promptTokens: modelUsage.promptTokens ?? null,
    completionTokens: modelUsage.completionTokens ?? null,
    totalTokens: modelUsage.totalTokens ?? null,
    pricing: {
      pricingKnown: pricing.pricingKnown ?? null,
      pricingSource: pricing.pricingSource ?? null,
      grossAmountCents: pricing.grossAmountCents ?? null,
      platformReceivableCents: pricing.platformReceivableCents ?? null,
      developerReceivableCents: pricing.developerReceivableCents ?? null,
    },
  };
};

const readJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: "response_not_json",
      textPreview: text.replace(/\s+/g, " ").slice(0, 160),
    };
  }
};

const main = async () => {
  const response = await fetch(`${baseUrl}/vendor/dijie/role-packages/generate`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${vendorBearer}`,
      "content-type": "application/json",
      ...(sellerId ? { "x-seller-id": sellerId } : {}),
    },
    body: JSON.stringify({ message: prompt }),
  });
  const body = await readJson(response);
  const draft = asObject(body.draft);
  const qualityReport = asObject(body.qualityReport ?? draft.qualityReport);
  const manifestSummary = asObject(body.manifestSummary ?? draft.manifestSummary);
  const files = asArray(body.files);

  const report = {
    baseUrl,
    endpoint: "/vendor/dijie/role-packages/generate",
    httpStatus: response.status,
    ok: response.ok && body.ok === true,
    modelCalled: body.modelCalled === true,
    error: body.error ?? null,
    issues: asArray(body.issues),
    draft: draft.draftId
      ? {
          draftId: draft.draftId,
          status: draft.status,
          packageId: draft.packageId,
          packageVersion: draft.packageVersion,
          fileCount: draft.fileCount,
          blockingIssues: asArray(draft.blockingIssues),
        }
      : null,
    manifestSummary: {
      name: manifestSummary.name ?? null,
      manifestRef: manifestSummary.manifestRef ?? null,
      requiredCapabilities: asArray(manifestSummary.requiredCapabilities),
      permissions: asArray(manifestSummary.permissions),
      fileCount: manifestSummary.fileCount ?? files.length,
    },
    generatedFilePaths: files.map((file) => asObject(file).path).filter(Boolean),
    qualityReport: {
      ok: qualityReport.ok ?? false,
      score: qualityReport.score ?? 0,
      blockingIssues: asArray(qualityReport.blockingIssues),
      requiredChecks: asArray(qualityReport.requiredChecks).map((check) => ({
        key: asObject(check).key,
        label: asObject(check).label,
        passed: asObject(check).passed,
      })),
    },
    capabilityReport: summarizeCapabilityReport(body.capabilityReport ?? draft.capabilityReport),
    uploadValidationIssues: asArray(body.uploadValidationIssues ?? draft.uploadValidationIssues),
    modelUsage: summarizeModelUsage(body.modelUsage ?? draft.modelUsage),
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
