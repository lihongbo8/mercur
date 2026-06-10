import type { DijieRoleEntitlementStorageRecord } from "./role-entitlement-store";
import type { DijieRoleListing } from "./role-listings";
import type { DijieRolePackageStorageRecord } from "./role-package-store";
import {
  DIJIE_PLATFORM_SKILL_TOOL_CATALOG,
  type DijieCatalogItem,
  type DijieCatalogKind,
  type DijieCatalogStatus,
} from "./role-skill-tool-planner";

export type DijieDispatcherGatewayRoleReadModel = {
  actorId: string;
  billingAccountId: string;
  workspaceRef: string | null;
  generatedAt: string;
  roles: DijieDispatcherGatewayRole[];
};

export type DijieDispatcherGatewayRole = {
  roleListingId: string;
  title: string;
  subtitle: string | null;
  usageInstructions: string | null;
  packageId: string | null;
  packageVersion: string | null;
  protocolVersion: string | null;
  capabilities: string[];
  scopes: string[];
  packageContext: DijieDispatcherGatewayRolePackageContext;
  callable: boolean;
  unavailableReasons: string[];
  entitlement: {
    id: string;
    status: DijieRoleEntitlementStorageRecord["entitlement_status"];
    source: DijieRoleEntitlementStorageRecord["source"];
    authorizedAt: string | null;
  } | null;
  billingPolicySnapshot: {
    authorizationFeeCents: number;
    currency: "CNY";
    inputTokenCentsPerMillion: number;
    outputTokenCentsPerMillion: number;
    developerReceivableBps: number;
    platformFeeBps: number;
  };
  usageSummary: {
    executionCount: number;
    lastExecutionAt: string | null;
  };
  reviewSignal: {
    listingStatus: string;
    reviewState: string | null;
  };
};

export type DijieDispatcherGatewayRolePackageContext = {
  packageId: string | null;
  packageVersion: string | null;
  protocolVersion: string | null;
  source: "package_record" | "listing_manifest";
  manifest: {
    entrypoint: string | null;
    manifestRef: string | null;
    sandbox: string | null;
    inputs: string[];
    outputs: string[];
  };
  requiredCapabilities: string[];
  catalogBindings: DijieDispatcherGatewayCatalogBinding[];
  effectiveCapabilities: string[];
  blockedCapabilities: DijieDispatcherGatewayBlockedCapability[];
  skills: string[];
  templates: string[];
  validation: string[];
  readme: string[];
  listing: string[];
  files: string[];
  validationIssues: string[];
  digest: string;
};

export type DijieDispatcherGatewayCatalogBinding = {
  need: string;
  catalogRef: string;
  kind: DijieCatalogKind;
  catalogStatus: DijieCatalogStatus | "missing";
  approved: boolean;
  name: string | null;
  version: string | null;
  riskLevel: DijieCatalogItem["riskLevel"] | null;
};

export type DijieDispatcherGatewayBlockedCapability = {
  need: string;
  catalogRef: string;
  kind: DijieCatalogKind;
  reason: "missing_catalog_item" | "catalog_item_not_approved";
  catalogStatus: DijieCatalogStatus | "missing";
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizePackageText(item))
    .filter(Boolean);
}

function sanitizePackageText(value: string): string {
  return value
    .trim()
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted-secret]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted-secret]")
    .replace(
      /\b(api[_-]?key|secret|provider[_ -]?auth|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^"'\s,;]+/gi,
      "$1=[redacted-secret]",
    )
    .replace(/\bfile:\/\/[^\s)]+/g, "[redacted-local-path]")
    .replace(/\b[A-Za-z]:[\\/][^\s)]+/g, "[redacted-local-path]")
    .replace(
      /(^|[\s(["'])(\/(?:Users|home|private|var|tmp|Volumes)\/[^\s)"']+)/g,
      "$1[redacted-local-path]",
    )
    .replace(
      /\b(?:exec|ent|device|workspace|gateway|cus|actor|user|ord|ordgrp|wallet|settlement|payment|acct)_[A-Za-z0-9][A-Za-z0-9_-]*\b/gi,
      "[redacted-private-id]",
    );
}

function sanitizePackagePath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const sanitized = sanitizePackageText(value).replace(/\\/g, "/");
  if (
    sanitized.startsWith("/") ||
    sanitized.startsWith("file://") ||
    /^[A-Za-z]:\//.test(sanitized)
  ) {
    return "[redacted-local-path]";
  }
  return sanitized;
}

function filePaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .map((item) => {
          const record = asRecord(item);
          return sanitizePackagePath(record.path);
        })
        .filter((path): path is string => Boolean(path)),
    ),
  ];
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.flatMap(stringArray))];
}

function catalogItemsForInput(items?: DijieCatalogItem[]): DijieCatalogItem[] {
  return items ?? DIJIE_PLATFORM_SKILL_TOOL_CATALOG;
}

function stringFromRecord(record: UnknownRecord, fields: string[]): string | undefined {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      return sanitizePackageText(value);
    }
  }
  return undefined;
}

function catalogKind(value: unknown, fallback: DijieCatalogKind): DijieCatalogKind {
  return value === "skill" ||
    value === "tool" ||
    value === "mcp" ||
    value === "adapter" ||
    value === "capability"
    ? value
    : fallback;
}

function catalogBindingRequests(
  value: unknown,
  fallbackKind: DijieCatalogKind,
): Array<{ need: string; catalogRef: string; kind: DijieCatalogKind }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      const catalogRef = sanitizePackageText(item);
      return [{ need: catalogRef, catalogRef, kind: fallbackKind }];
    }
    const record = asRecord(item);
    const catalogRef = stringFromRecord(record, ["catalogRef", "catalog_ref", "ref"]);
    if (!catalogRef) {
      return [];
    }
    return [
      {
        need: stringFromRecord(record, ["need", "capability", "name"]) ?? catalogRef,
        catalogRef,
        kind: catalogKind(record.kind, fallbackKind),
      },
    ];
  });
}

function resolveCatalogBindings(input: {
  manifest: UnknownRecord;
  catalogItems?: DijieCatalogItem[];
}): {
  catalogBindings: DijieDispatcherGatewayCatalogBinding[];
  effectiveCapabilities: string[];
  blockedCapabilities: DijieDispatcherGatewayBlockedCapability[];
} {
  const catalogItems = catalogItemsForInput(input.catalogItems);
  const byRef = new Map(catalogItems.map((item) => [item.id, item]));
  const requests = [
    ...catalogBindingRequests(input.manifest.requiredSkills, "skill"),
    ...catalogBindingRequests(input.manifest.required_skills, "skill"),
    ...catalogBindingRequests(input.manifest.requiredTools, "tool"),
    ...catalogBindingRequests(input.manifest.required_tools, "tool"),
  ];
  const dedupedRequests = [
    ...new Map(requests.map((request) => [request.catalogRef, request])).values(),
  ];
  const catalogBindings: DijieDispatcherGatewayCatalogBinding[] = dedupedRequests.map((request) => {
    const item = byRef.get(request.catalogRef);
    const catalogStatus: DijieCatalogStatus | "missing" = item?.status ?? "missing";
    return {
      need: request.need,
      catalogRef: request.catalogRef,
      kind: item?.kind ?? request.kind,
      catalogStatus,
      approved: item?.status === "approved",
      name: item?.name ?? null,
      version: item?.version ?? null,
      riskLevel: item?.riskLevel ?? null,
    };
  });
  const effectiveCapabilities = [
    ...new Set(
      catalogBindings
        .filter((binding) => binding.approved)
        .flatMap((binding) => byRef.get(binding.catalogRef)?.provides ?? [binding.need]),
    ),
  ];
  const blockedCapabilities: DijieDispatcherGatewayBlockedCapability[] = catalogBindings.flatMap((binding) => {
    if (binding.approved) {
      return [];
    }
    return [
      {
        need: binding.need,
        catalogRef: binding.catalogRef,
        kind: binding.kind,
        reason:
          binding.catalogStatus === "missing"
            ? ("missing_catalog_item" as const)
            : ("catalog_item_not_approved" as const),
        catalogStatus: binding.catalogStatus,
      },
    ];
  });
  return { catalogBindings, effectiveCapabilities, blockedCapabilities };
}

function packageRecordForRole(
  role: DijieRoleListing,
  packages: Array<DijieRolePackageStorageRecord & { id?: string }>,
) {
  return packages.find(
    (record) =>
      record.package_id === role.packageId &&
      (!role.packageVersion || record.package_version === role.packageVersion),
  );
}

function pathsMatching(paths: string[], pattern: RegExp): string[] {
  return paths.filter((path) => pattern.test(path));
}

function contextDigest(
  context: Omit<DijieDispatcherGatewayRolePackageContext, "digest">,
): string {
  const json = JSON.stringify(context);
  let hash = 0;
  for (let index = 0; index < json.length; index += 1) {
    hash = (hash * 31 + json.charCodeAt(index)) >>> 0;
  }
  return `pkgctx_${hash.toString(16).padStart(8, "0")}`;
}

function createPackageContext(
  role: DijieRoleListing,
  packageRecord?: DijieRolePackageStorageRecord & { id?: string },
  catalogItems?: DijieCatalogItem[],
): DijieDispatcherGatewayRolePackageContext {
  const manifest = asRecord(packageRecord?.manifest_summary ?? {});
  const paths = filePaths(packageRecord?.file_manifest);
  const fallbackRequiredCapabilities = stringArray(role.capabilities);
  const packageRequiredCapabilities = uniqueStrings([
    manifest.requiredCapabilities,
    manifest.required_capabilities,
  ]);
  const requiredCapabilities =
    packageRequiredCapabilities.length > 0
      ? packageRequiredCapabilities
      : fallbackRequiredCapabilities;
  const catalog = resolveCatalogBindings({ manifest, catalogItems });
  const context = {
    packageId: role.packageId,
    packageVersion: role.packageVersion,
    protocolVersion: role.protocolVersion,
    source: packageRecord ? ("package_record" as const) : ("listing_manifest" as const),
    manifest: {
      entrypoint:
        sanitizePackagePath(manifest.entrypoint) ?? null,
      manifestRef:
        sanitizePackagePath(manifest.manifestRef) ??
        sanitizePackagePath(manifest.manifest_ref) ??
        null,
      sandbox: sanitizePackagePath(manifest.sandbox) ?? null,
      inputs: uniqueStrings([manifest.inputs, manifest.inputRequirements]),
      outputs: uniqueStrings([manifest.outputs, manifest.outputExamples]),
    },
    requiredCapabilities,
    catalogBindings: catalog.catalogBindings,
    effectiveCapabilities: catalog.effectiveCapabilities,
    blockedCapabilities: catalog.blockedCapabilities,
    skills: pathsMatching(paths, /(^|\/)(skills?|skill)(\/|[-_.])/iu),
    templates: pathsMatching(paths, /(^|\/)(templates?|template)(\/|[-_.])/iu),
    validation: pathsMatching(paths, /(^|\/)(validation|tests?|smoke|checklists?)(\/|[-_.])/iu),
    readme: pathsMatching(paths, /(^|\/)readme(\.|$)/iu),
    listing: pathsMatching(paths, /(^|\/)(listing|marketplace|商品|上架)(\.|\/|-|_)/iu),
    files: paths,
    validationIssues: stringArray(packageRecord?.validation_issues),
  };
  return {
    ...context,
    digest: contextDigest(context),
  };
}

function authorizedEntitlementForRole(
  role: DijieRoleListing,
  entitlements: Array<DijieRoleEntitlementStorageRecord & { id: string }>,
) {
  return entitlements.find(
    (entitlement) =>
      entitlement.role_listing_id === role.id &&
      entitlement.entitlement_status === "authorized",
  );
}

function unavailableReasons(
  role: DijieRoleListing,
  entitlement?: DijieRoleEntitlementStorageRecord & { id: string },
  packageContext?: DijieDispatcherGatewayRolePackageContext,
): string[] {
  const reasons: string[] = [];
  if (!role.packageId || !role.packageVersion) {
    reasons.push("missing_package");
  }
  if (role.listingStatus !== "published" || role.reviewState !== "approved") {
    reasons.push("not_published_or_not_approved");
  }
  if (!entitlement) {
    reasons.push("missing_entitlement");
  }
  if ((packageContext?.blockedCapabilities.length ?? 0) > 0) {
    reasons.push("blocked_catalog_bindings");
  }
  return reasons;
}

export function buildDijieDispatcherGatewayRoleReadModel(input: {
  actorId: string;
  billingAccountId?: string | null;
  workspaceRef?: string | null;
  roles: DijieRoleListing[];
  entitlements?: Array<DijieRoleEntitlementStorageRecord & { id: string }>;
  packages?: Array<DijieRolePackageStorageRecord & { id?: string }>;
  catalogItems?: DijieCatalogItem[];
  generatedAt?: Date;
}): DijieDispatcherGatewayRoleReadModel {
  const entitlements = input.entitlements ?? [];
  const packages = input.packages ?? [];

  return {
    actorId: input.actorId,
    billingAccountId: input.billingAccountId ?? input.actorId,
    workspaceRef: input.workspaceRef ?? null,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    roles: input.roles.map((role) => {
      const entitlement = authorizedEntitlementForRole(role, entitlements);
      const packageRecord = packageRecordForRole(role, packages);
      const packageContext = createPackageContext(role, packageRecord, input.catalogItems);
      const reasons = unavailableReasons(role, entitlement, packageContext);

      return {
        roleListingId: role.id,
        title: role.title,
        subtitle: role.subtitle,
        usageInstructions: role.usageInstructions,
        packageId: role.packageId,
        packageVersion: role.packageVersion,
        protocolVersion: role.protocolVersion,
        capabilities: role.capabilities,
        scopes: role.scopes,
        packageContext,
        callable: reasons.length === 0,
        unavailableReasons: reasons,
        entitlement: entitlement
          ? {
              id: entitlement.id,
              status: entitlement.entitlement_status,
              source: entitlement.source,
              authorizedAt: entitlement.authorized_at.toISOString(),
            }
          : null,
        billingPolicySnapshot: {
          authorizationFeeCents: role.pricing.authorizationFeeCents,
          currency: "CNY",
          inputTokenCentsPerMillion:
            role.roleTokenPricing.inputTokenCentsPerMillion,
          outputTokenCentsPerMillion:
            role.roleTokenPricing.outputTokenCentsPerMillion,
          developerReceivableBps: role.roleTokenPricing.developerReceivableBps,
          platformFeeBps: role.roleTokenPricing.platformFeeBps,
        },
        usageSummary: {
          executionCount: 0,
          lastExecutionAt: null,
        },
        reviewSignal: {
          listingStatus: role.listingStatus,
          reviewState: role.reviewState,
        },
      };
    }),
  };
}
