import {
  getDijieDialogBillingPolicy,
  type DijieDialogBillingPolicy,
  type DijieDialogContext,
  type DijieDialogSurface,
} from "./dialog-context";

export type DijieDialogWorkflowRouter =
  | "marketplace_discovery"
  | "user_records"
  | "developer_center"
  | "review_assist"
  | "main_workflow"
  | "developer_workspace";

export type DijieDialogUsageLayer =
  | "marketplace_assist"
  | "user_assist"
  | "developer_management_assist"
  | "review_assist"
  | "main_workflow_assist"
  | "developer_workspace_assist";

export type DijieDialogMeteringPolicy = {
  metered: true;
  modelAllowed: boolean;
  usageLayer: DijieDialogUsageLayer;
  ledgerSource: DijieDialogBillingPolicy["ledgerSource"];
  chargedBy: "system_platform";
  billingAccountId: string;
  actorAccountId: string;
  note: string;
};

export type DijieDialogCapabilityPolicy = {
  surface: DijieDialogSurface;
  mode: DijieDialogContext["mode"];
  workflowRouter: DijieDialogWorkflowRouter;
  allowedDataScopes: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  requiresLocalSystemAccess: boolean;
  requiresEntitlement: boolean;
  requiresMarketplaceOwnerAccess: boolean;
  canMutateBusinessState: false;
  meteringPolicy: DijieDialogMeteringPolicy;
};

type PolicyTemplate = Omit<
  DijieDialogCapabilityPolicy,
  "surface" | "mode" | "requiresEntitlement" | "meteringPolicy"
> & {
  usageLayer: DijieDialogUsageLayer;
  modelAllowed: boolean;
};

function mainWorkflowTemplate(): PolicyTemplate {
  return {
    workflowRouter: "main_workflow",
    allowedDataScopes: [
      "main_workflow_refs",
      "authorized_roles",
      "task_packages",
      "execution_records",
      "ledger_summary",
      "human_confirm_requests",
    ],
    allowedActions: [
      "understand_goal",
      "plan_role_execution",
      "check_entitlement",
      "check_execution_token",
      "navigate_goal",
      "navigate_planning",
      "navigate_dispatch",
      "prepare_role_task",
      "explain_execution",
      "read_audit_summary",
    ],
    forbiddenActions: [
      "bypass_goal_governance",
      "create_task_without_dispatch",
      "execute_without_entitlement",
      "execute_without_confirmation",
      "mutate_cloud_private_data",
    ],
    requiresLocalSystemAccess: true,
    requiresMarketplaceOwnerAccess: false,
    canMutateBusinessState: false,
    usageLayer: "main_workflow_assist",
    modelAllowed: true,
  };
}

const POLICY_BY_SURFACE: Record<DijieDialogSurface, PolicyTemplate> = {
  buyer_storefront: {
    workflowRouter: "marketplace_discovery",
    allowedDataScopes: ["public_role_listings", "current_account_authorization_summary"],
    allowedActions: ["search_roles", "explain_public_role", "navigate_authorization"],
    forbiddenActions: [
      "purchase_without_confirmation",
      "read_private_execution",
      "main_workflow_dispatch",
    ],
    requiresLocalSystemAccess: false,
    requiresMarketplaceOwnerAccess: false,
    canMutateBusinessState: false,
    usageLayer: "marketplace_assist",
    modelAllowed: true,
  },
  user_center: {
    workflowRouter: "user_records",
    allowedDataScopes: ["own_entitlements", "own_executions", "own_ledger_entries"],
    allowedActions: [
      "explain_records",
      "navigate_role",
      "navigate_execution",
      "navigate_ledger",
      "prepare_role_execution",
      "prepare_execution_intent",
      "route_company_execution_to_local_openclaw",
    ],
    forbiddenActions: ["read_other_accounts", "developer_backoffice", "main_workflow_dispatch"],
    requiresLocalSystemAccess: false,
    requiresMarketplaceOwnerAccess: false,
    canMutateBusinessState: false,
    usageLayer: "user_assist",
    modelAllowed: true,
  },
  developer_center: {
    workflowRouter: "developer_center",
    allowedDataScopes: [
      "owned_role_packages",
      "owned_role_listings",
      "review_status",
      "receivables_summary",
    ],
    allowedActions: [
      "explain_package_status",
      "generate_role_package",
      "repair_role_package_draft",
      "navigate_upload",
      "navigate_listing",
      "navigate_sales",
      "navigate_payouts",
      "navigate_capabilities",
      "navigate_profile",
      "explain_pricing",
    ],
    forbiddenActions: ["review_own_listing", "read_buyer_private_data", "main_workflow_dispatch"],
    requiresLocalSystemAccess: false,
    requiresMarketplaceOwnerAccess: false,
    canMutateBusinessState: false,
    usageLayer: "developer_management_assist",
    modelAllowed: true,
  },
  admin_review: {
    workflowRouter: "review_assist",
    allowedDataScopes: ["role_review_queue", "role_package_summary", "pricing_risk_summary"],
    allowedActions: [
      "summarize_listing",
      "draft_review_note",
      "evaluate_pricing_risk",
      "evaluate_safety_compliance",
    ],
    forbiddenActions: ["auto_approve", "auto_reject", "local_customer_admin_access"],
    requiresLocalSystemAccess: false,
    requiresMarketplaceOwnerAccess: true,
    canMutateBusinessState: false,
    usageLayer: "review_assist",
    modelAllowed: true,
  },
  openclaw_main: mainWorkflowTemplate(),
  openclaw_local: mainWorkflowTemplate(),
};

function developerWorkspaceTemplate(): PolicyTemplate {
  return {
    workflowRouter: "developer_workspace",
    allowedDataScopes: ["local_package_workspace", "package_preflight", "developer_test_runs"],
    allowedActions: ["explain_package_generation", "navigate_preflight", "explain_test_run"],
    forbiddenActions: ["read_customer_private_data", "execute_customer_role_task"],
    requiresLocalSystemAccess: true,
    requiresMarketplaceOwnerAccess: false,
    canMutateBusinessState: false,
    usageLayer: "developer_workspace_assist",
    modelAllowed: true,
  };
}

export function getDijieDialogCapabilityPolicy(
  context: DijieDialogContext,
): DijieDialogCapabilityPolicy {
  const billingPolicy = getDijieDialogBillingPolicy(context);
  const template =
    context.surface === "openclaw_local" && context.mode === "developer"
      ? developerWorkspaceTemplate()
      : POLICY_BY_SURFACE[context.surface];

  return {
    surface: context.surface,
    mode: context.mode,
    workflowRouter: template.workflowRouter,
    allowedDataScopes: template.allowedDataScopes,
    allowedActions: template.allowedActions,
    forbiddenActions: template.forbiddenActions,
    requiresLocalSystemAccess: template.requiresLocalSystemAccess,
    requiresEntitlement: billingPolicy.requiresEntitlement,
    requiresMarketplaceOwnerAccess: template.requiresMarketplaceOwnerAccess,
    canMutateBusinessState: false,
    meteringPolicy: {
      metered: true,
      modelAllowed: template.modelAllowed,
      usageLayer: template.usageLayer,
      ledgerSource: billingPolicy.ledgerSource,
      chargedBy: "system_platform",
      billingAccountId: context.billingAccountId,
      actorAccountId: context.accountId,
      note:
        template.modelAllowed
          ? "该入口所有模型与辅助用量都进入统一计量，由系统平台按账号费用归属收费。"
          : "该入口当前不调用模型，但导航和管理辅助仍进入统一计量口径。",
    },
  };
}
