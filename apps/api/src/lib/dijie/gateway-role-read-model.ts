import type { DijieRoleEntitlementStorageRecord } from "./role-entitlement-store";
import type { DijieRoleListing } from "./role-listings";

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
  packageId: string | null;
  packageVersion: string | null;
  protocolVersion: string | null;
  capabilities: string[];
  scopes: string[];
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
  return reasons;
}

export function buildDijieDispatcherGatewayRoleReadModel(input: {
  actorId: string;
  billingAccountId?: string | null;
  workspaceRef?: string | null;
  roles: DijieRoleListing[];
  entitlements?: Array<DijieRoleEntitlementStorageRecord & { id: string }>;
  generatedAt?: Date;
}): DijieDispatcherGatewayRoleReadModel {
  const entitlements = input.entitlements ?? [];

  return {
    actorId: input.actorId,
    billingAccountId: input.billingAccountId ?? input.actorId,
    workspaceRef: input.workspaceRef ?? null,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    roles: input.roles.map((role) => {
      const entitlement = authorizedEntitlementForRole(role, entitlements);
      const reasons = unavailableReasons(role, entitlement);

      return {
        roleListingId: role.id,
        title: role.title,
        subtitle: role.subtitle,
        packageId: role.packageId,
        packageVersion: role.packageVersion,
        protocolVersion: role.protocolVersion,
        capabilities: role.capabilities,
        scopes: role.scopes,
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
          inputTokenCentsPerMillion: role.roleTokenPricing.inputTokenCentsPerMillion,
          outputTokenCentsPerMillion: role.roleTokenPricing.outputTokenCentsPerMillion,
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
