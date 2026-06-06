import crypto from "node:crypto";

type UnknownRecord = Record<string, unknown>;

export type DijieRolePackageUploadFile = {
  path: string;
  content?: string;
  sha256?: string;
  sizeBytes?: number;
};

export type DijieRolePackageUploadSummary = {
  packageId: string;
  packageVersion: string;
  manifestSummary: {
    entrypoint: string;
    manifestRef: string;
    name: string;
    permissions: string[];
    requiredCapabilities: string[];
    fileCount: number;
  };
  files: Array<{
    path: string;
    sha256?: string;
    sizeBytes?: number;
  }>;
};

export type DijieRolePackageUploadResult =
  | { ok: true; value: DijieRolePackageUploadSummary }
  | { ok: false; issues: string[] };

const REQUIRED_PACKAGE_FILES = [
  "role_package/manifest.json",
  "role_package/listing.md",
  "role_package/README.md",
];

const TOOL_IMPLEMENTATION_KEY_NAMES = new Set([
  "browsertool",
  "commandtool",
  "filetool",
  "implementationtool",
  "implementationtools",
  "mcpserver",
  "mcpservers",
  "tooldefinition",
  "tooldefinitions",
  "toolimplementation",
  "toolimplementations",
  "toolruntime",
  "tools",
]);

const BACKEND_ONLY_KEY_NAMES = new Set([
  "actorid",
  "actorcontext",
  "buildbrief",
  "chat",
  "chathistory",
  "chats",
  "cloudbearer",
  "conversation",
  "conversationhistory",
  "conversations",
  "deviceid",
  "developerbuildcontext",
  "developermodecontext",
  "entitlementid",
  "executionid",
  "history",
  "localgatewayid",
  "message",
  "messages",
  "modestage",
  "order",
  "ordergroup",
  "ordergroupid",
  "orderid",
  "pricing",
  "pricingsnapshot",
  "prompt",
  "prompts",
  "rolebuildbrief",
  "rolelistingid",
  "sessionid",
  "wallet",
  "walletid",
  "workspace",
  "workspaceref",
]);

const BACKEND_ONLY_VALUE_PATTERN =
  /\b(?:exec|cus|ent|ord|ordgrp|wallet|device|workspace|gateway|audit|settlement)_[A-Za-z0-9][A-Za-z0-9_-]*\b/i;
const LOCAL_ABSOLUTE_PATH_PATTERN =
  /(?:^|[\s"'(=:[,])(?:\/(?:Users|private|tmp|var|home|opt|Volumes)\/[^\s"',)]+|[A-Za-z]:\\[^\s"',)]+)/u;
const PROVIDER_SECRET_PATTERN =
  /\b(?:sk-[A-Za-z0-9][A-Za-z0-9_-]{12,}|sk-ant-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,})\b/i;
const SENSITIVE_KEY_PATTERN =
  /(api[_-]?key|secret|provider[_-]?(auth|key)|access[_-]?token|refresh[_-]?token|bearer|cloud[_-]?bearer|raw[_-]?(execution[_-]?)?token|execution[_-]?token)/i;
const BACKEND_ONLY_TEXT_PATTERN =
  /\b(?:actorId|chatHistory|cloudBearer|conversationHistory|developerModeContext|deviceId|entitlementId|executionId|localGatewayId|modeStage|orderGroupId|orderId|pricingSnapshot|prompt|roleBuildBrief|roleListingId|walletId|workspaceRef)\b/i;
const REQUIRED_CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const TOOL_IMPLEMENTATION_PATH_PATTERN =
  /(^|\/)(tool-?implementations?|tools?|mcp-?servers?|browser-?tools?|command-?tools?|api-?clients?)(\/|[-_.])/iu;
const ROLE_KNOWLEDGE_PATH_PATTERN =
  /(^|\/)(business|knowledge|playbooks?|sops?|workflows?|experience|failure-modes?|examples?)(\/|[-_.])|[-_.](business|knowledge|playbook|sop|workflow|experience|failure-mode|example)\./iu;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringField(record: UnknownRecord, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePackagePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
}

function isLocalAbsolutePath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, "/");
  return (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.startsWith("file://") ||
    LOCAL_ABSOLUTE_PATH_PATTERN.test(value)
  );
}

function hasUnsafeRelativePathSegment(value: string): boolean {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .some((segment) => segment === "..");
}

function isToolImplementationPath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/").toLowerCase();
  if (/(^|\/)tool[_-]?requirements\.md$/u.test(normalized)) {
    return false;
  }
  return TOOL_IMPLEMENTATION_PATH_PATTERN.test(value);
}

function validateRequiredCapabilities(value: unknown, path: string, issues: string[]): string[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be a non-empty array of abstract OpenClaw capability needs.`);
    return [];
  }

  const capabilities = stringArray(value);
  if (capabilities.length === 0) {
    issues.push(`${path} must include at least one abstract OpenClaw capability need.`);
    return [];
  }

  for (const capability of capabilities) {
    if (!REQUIRED_CAPABILITY_PATTERN.test(capability)) {
      issues.push(`${path} entries must be stable capability names like workspace.read or human.confirm.`);
      break;
    }
    if (
      SENSITIVE_KEY_PATTERN.test(capability) ||
      PROVIDER_SECRET_PATTERN.test(capability) ||
      BACKEND_ONLY_VALUE_PATTERN.test(capability)
    ) {
      issues.push(`${path} entries must not contain secrets, backend ids, or provider auth material.`);
      break;
    }
  }

  return [...new Set(capabilities)];
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function scanValue(value: unknown, path: string, issues: string[]) {
  if (typeof value === "string") {
    if (isLocalAbsolutePath(value)) {
      issues.push(`${path} must not contain a local absolute path.`);
    }
    if (PROVIDER_SECRET_PATTERN.test(value) || BACKEND_ONLY_VALUE_PATTERN.test(value)) {
      issues.push(`${path} must not contain raw tokens, provider secrets, or backend ids.`);
    }
    if (BACKEND_ONLY_TEXT_PATTERN.test(value)) {
      issues.push(`${path} must not contain backend-only field names.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanValue(entry, `${path}[${index}]`, issues));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, entry] of Object.entries(value as UnknownRecord)) {
    const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (BACKEND_ONLY_KEY_NAMES.has(normalizedKey)) {
      issues.push(`${path}.${key} is a backend-only field and cannot be stored in a role package.`);
    }
    if (TOOL_IMPLEMENTATION_KEY_NAMES.has(normalizedKey)) {
      issues.push(
        `${path}.${key} must not define implementation tools or tool schemas; declare requiredCapabilities and let the local OpenClaw tool protocol execute them instead.`,
      );
    }
    if (!["secretsRequired", "secrets_required"].includes(key) && SENSITIVE_KEY_PATTERN.test(key)) {
      issues.push(`${path}.${key} must not contain secret, token, or provider auth fields.`);
    }
    scanValue(entry, `${path}.${key}`, issues);
  }
}

function readUploadFiles(input: UnknownRecord): DijieRolePackageUploadFile[] {
  const files = input.files ?? asRecord(input.rolePackage).files;
  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap((file): DijieRolePackageUploadFile[] => {
    const record = asRecord(file);
    const rawPath = stringField(record, "path") ?? stringField(record, "relativePath");
    if (!rawPath) {
      return [];
    }
    const path = normalizePackagePath(rawPath);
    const content = typeof record.content === "string" ? record.content : undefined;
    const sizeBytes =
      typeof record.sizeBytes === "number" && Number.isSafeInteger(record.sizeBytes)
        ? record.sizeBytes
        : content
          ? Buffer.byteLength(content)
          : undefined;
    const digest = stringField(record, "sha256") ?? (content ? sha256(content) : undefined);

    return [
      {
        path,
        ...(content !== undefined ? { content } : {}),
        ...(digest ? { sha256: digest } : {}),
        ...(sizeBytes !== undefined ? { sizeBytes } : {}),
      },
    ];
  });
}

export function readDijieRolePackageUploadFilesForStorage(
  value: unknown,
): DijieRolePackageUploadFile[] {
  return readUploadFiles(asRecord(value));
}

function readManifest(input: UnknownRecord, files: DijieRolePackageUploadFile[]): UnknownRecord {
  const manifestFile = files.find((file) => file.path === "role_package/manifest.json");
  if (!manifestFile?.content) {
    return asRecord(input.manifest ?? asRecord(input.rolePackage).manifest);
  }

  try {
    return asRecord(JSON.parse(manifestFile.content));
  } catch {
    return {};
  }
}

export function validateDijieRolePackageUpload(input: unknown): DijieRolePackageUploadResult {
  const body = asRecord(input);
  const files = readUploadFiles(body);
  const manifest = readManifest(body, files);
  const issues: string[] = [];

  if (Object.keys(manifest).length === 0) {
    issues.push("role_package/manifest.json is required and must contain valid JSON.");
  }

  if (manifest.manifestVersion !== 1) {
    issues.push("role package manifestVersion must be 1.");
  }

  const packageId = stringField(manifest, "rolePackageId") ?? stringField(body, "packageId");
  const packageVersion = stringField(manifest, "version") ?? stringField(body, "packageVersion");
  const name = stringField(manifest, "name");
  const entrypoint = stringField(manifest, "entrypoint");
  const permissions = stringArray(manifest.permissions);
  const requiredCapabilities = validateRequiredCapabilities(
    manifest.requiredCapabilities ?? manifest.required_capabilities,
    "role package manifest requiredCapabilities",
    issues,
  );

  if (!packageId) {
    issues.push("role package manifest rolePackageId is required.");
  }
  if (!packageVersion) {
    issues.push("role package manifest version is required.");
  }
  if (!name) {
    issues.push("role package manifest name is required.");
  }
  if (!entrypoint) {
    issues.push("role package manifest entrypoint is required.");
  } else if (!entrypoint.startsWith("role_package/") || isLocalAbsolutePath(entrypoint)) {
    issues.push("role package manifest entrypoint must be a role_package/ relative path.");
  }
  if (!Array.isArray(manifest.permissions)) {
    issues.push("role package manifest permissions must be an array.");
  }
  if (!Array.isArray(manifest.files)) {
    issues.push("role package manifest files must be an array.");
  }

  for (const file of files) {
    if (
      !file.path.startsWith("role_package/") ||
      isLocalAbsolutePath(file.path) ||
      hasUnsafeRelativePathSegment(file.path)
    ) {
      issues.push(`${file.path} must be inside role_package/ and must be relative.`);
    }
    if (isToolImplementationPath(file.path)) {
      issues.push(
        `${file.path} must not ship implementation tools or tool schemas; role packages declare requiredCapabilities and local OpenClaw executes through tools.catalog/tools.effective/tools.invoke.`,
      );
    }
    if (file.content) {
      scanValue(file.content, file.path, issues);
    }
  }

  const uploadedPaths = new Set(files.map((file) => file.path));
  for (const requiredFile of REQUIRED_PACKAGE_FILES) {
    if (!uploadedPaths.has(requiredFile)) {
      issues.push(`missing ${requiredFile}`);
    }
  }

  const packagePaths = [...uploadedPaths];
  if (
    !packagePaths.some((path) =>
      /(^|\/)(wrappers?|adapters?|examples?|samples?|integrations?)(\/|[-_.])|[-_.](wrapper|adapter|example|sample|integration)\./i.test(
        path,
      ),
    )
  ) {
    issues.push("missing role_package wrapper, adapter, or integration example file");
  }
  if (!packagePaths.some((path) => /(validation|validate|smoke|tests?|spec)(\/|[-_.]|\.)/i.test(path))) {
    issues.push("missing role_package validation or smoke test material");
  }
  if (!packagePaths.some((path) => ROLE_KNOWLEDGE_PATH_PATTERN.test(path))) {
    issues.push("missing role_package business knowledge, workflow, experience, or example material");
  }

  scanValue(manifest, "manifest", issues);

  if (issues.length > 0 || !packageId || !packageVersion || !name || !entrypoint) {
    return { ok: false, issues: [...new Set(issues)] };
  }

  return {
    ok: true,
    value: {
      packageId,
      packageVersion,
      manifestSummary: {
        entrypoint,
        manifestRef: "role_package/manifest.json",
        name,
        permissions,
        requiredCapabilities,
        fileCount: files.length,
      },
      files: files.map((file) => ({
        path: file.path,
        ...(file.sha256 ? { sha256: file.sha256 } : {}),
        ...(file.sizeBytes !== undefined ? { sizeBytes: file.sizeBytes } : {}),
      })),
    },
  };
}
