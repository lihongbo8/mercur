import type { DijieDialogCapabilityPolicy } from "./dialog-capability-policy";
import type {
  DijieDialogAccountType,
  DijieDialogContext,
  DijieDialogMode,
  DijieDialogSubject,
  DijieDialogSurface,
} from "./dialog-context";
import {
  createDijieDialogModelBillingAmounts,
  createDijieDialogModelUsageMeters,
} from "./dialog-model-bridge";
import type { DijieDialogMessageResponse } from "./dialog-messages";
import {
  createDijieLedgerEntryReadModel,
  createDijieLedgerEntryWithRepository,
  type DijieLedgerEntryRepository,
  type DijieLedgerEntryStorageRecord,
} from "./ledger-store";

export type DijieDialogSessionStorageRecord = {
  account_id: string;
  account_type: DijieDialogAccountType;
  surface: DijieDialogSurface;
  mode: DijieDialogMode;
  billing_account_id: string;
  subject: DijieDialogSubject;
  capability_policy: DijieDialogCapabilityPolicy;
  title: string | null;
  last_message_at: Date;
};

export type DijieDialogMessageRole = "user" | "assistant";

export type DijieDialogMessageStorageRecord = {
  session_id: string;
  account_id: string;
  message_role: DijieDialogMessageRole;
  content: string;
  grounding: DijieDialogMessageResponse["grounding"] | null;
  model_called: boolean;
  model_usage: unknown | null;
  ledger_entry_id: string | null;
  occurred_at: Date;
};

export type DijieDialogSessionRepository = {
  createDijieDialogSessions: (
    data: DijieDialogSessionStorageRecord,
  ) => Promise<DijieDialogSessionStorageRecord & { id: string }>;
};

export type DijieDialogSessionLookupRepository = {
  listDijieDialogSessions: (
    filters?: Record<string, unknown>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieDialogSessionStorageRecord & { id: string }>>;
};

export type DijieDialogSessionUpdateRepository = {
  updateDijieDialogSessions: (
    data: Partial<DijieDialogSessionStorageRecord> & { id: string },
  ) => Promise<DijieDialogSessionStorageRecord & { id: string }>;
};

export type DijieDialogMessageRepository = {
  createDijieDialogMessages: (
    data: DijieDialogMessageStorageRecord,
  ) => Promise<DijieDialogMessageStorageRecord & { id: string }>;
};

export type DijieDialogMessageLookupRepository = {
  listDijieDialogMessages: (
    filters?: Record<string, unknown>,
    config?: {
      take?: number;
      order?: Record<string, "ASC" | "DESC">;
    },
  ) => Promise<Array<DijieDialogMessageStorageRecord & { id: string }>>;
};

export type DijieDialogSessionReader = {
  listDijieDialogSessionsForAccount: (input: {
    accountId?: string;
    surface?: DijieDialogSurface;
    take?: number;
  }) => Promise<Array<DijieDialogSessionStorageRecord & { id: string }>>;
  retrieveDijieDialogSessionWithMessages: (input: {
    sessionId: string;
    accountId?: string;
  }) => Promise<
    | {
        session: DijieDialogSessionStorageRecord & { id: string };
        messages: Array<DijieDialogMessageStorageRecord & { id: string }>;
      }
    | undefined
  >;
};

export type DijieDialogSessionStore = DijieDialogSessionReader & {
  recordDijieDialogTurn: (
    input: RecordDijieDialogTurnInput,
  ) => Promise<RecordDijieDialogTurnResult>;
};

export type RecordDijieDialogTurnInput = {
  sessionId?: string;
  context: DijieDialogContext;
  capabilityPolicy: DijieDialogCapabilityPolicy;
  userMessage: string;
  assistantReply: DijieDialogMessageResponse;
};

export type RecordDijieDialogTurnResult =
  | {
      ok: true;
      value: {
        session: DijieDialogSessionStorageRecord & { id: string };
        userMessage: DijieDialogMessageStorageRecord & { id: string };
        assistantMessage: DijieDialogMessageStorageRecord & { id: string };
        ledgerEntry: DijieLedgerEntryStorageRecord & { id: string };
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

type DialogTurnRepository = DijieDialogSessionRepository &
  DijieDialogSessionLookupRepository &
  DijieDialogSessionUpdateRepository &
  DijieDialogMessageRepository &
  DijieDialogMessageLookupRepository &
  DijieLedgerEntryRepository;

const SENSITIVE_KEY_PATTERN =
  /(?:authorization|bearer|token|secret|api[_-]?key|provider[_-]?auth|cloud[_-]?bearer|password|credential)/iu;
const SAFE_MODEL_USAGE_KEYS = new Set([
  "requestcount",
  "prompttokens",
  "inputtokens",
  "completiontokens",
  "outputtokens",
  "cachereadtokens",
  "cachewritetokens",
  "totaltokens",
]);

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeTitle(value: string): string {
  const normalized = sanitizeSensitiveText(value).replace(/\s+/gu, " ").trim();
  return normalized.length > 60 ? `${normalized.slice(0, 60)}...` : normalized || "新对话";
}

export function sanitizeSensitiveText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/giu, "Bearer [redacted-token]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted-jwt]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gu, "[redacted-model-key]")
    .replace(
      /\b(api[_-]?key|provider[_-]?auth|cloud[_-]?bearer|token|secret|password)\s*[:=]\s*[^\s"',)]+/giu,
      "$1=[redacted-secret]",
    )
    .replace(/\bfile:\/\/[^\s)"']+/giu, "[redacted-local-path]")
    .replace(/\b[A-Za-z]:[\\/][^\s)"']+/gu, "[redacted-local-path]")
    .replace(
      /(^|[\s(["'])(\/(?:Users|home|private|var|tmp|Volumes)\/[^\s)"']+)/gu,
      "$1[redacted-local-path]",
    );
}

export function sanitizeDialogStorageValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDialogStorageValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        const normalizedKey = key.replace(/[^a-z0-9]/giu, "").toLowerCase();
        return [
          key,
          SENSITIVE_KEY_PATTERN.test(key) && !SAFE_MODEL_USAGE_KEYS.has(normalizedKey)
            ? "[redacted-secret]"
            : sanitizeDialogStorageValue(entry),
        ];
      }),
    );
  }
  return value;
}

export function createDijieDialogSessionReadModel(
  session: DijieDialogSessionStorageRecord & { id: string },
) {
  return {
    id: session.id,
    accountId: session.account_id,
    accountType: session.account_type,
    surface: session.surface,
    mode: session.mode,
    billingAccountId: session.billing_account_id,
    subject: session.subject,
    capabilityPolicy: session.capability_policy,
    title: session.title,
    lastMessageAt:
      session.last_message_at instanceof Date
        ? session.last_message_at.toISOString()
        : session.last_message_at,
  };
}

export function createDijieDialogMessageReadModel(
  message: DijieDialogMessageStorageRecord & { id: string },
) {
  return {
    id: message.id,
    sessionId: message.session_id,
    role: message.message_role,
    content: message.content,
    grounding: message.grounding,
    modelCalled: message.model_called,
    modelUsage: message.model_usage,
    ledgerEntryId: message.ledger_entry_id,
    occurredAt:
      message.occurred_at instanceof Date ? message.occurred_at.toISOString() : message.occurred_at,
  };
}

async function getExistingSession(
  repository: DijieDialogSessionLookupRepository,
  input: {
    sessionId?: string;
    accountId: string;
  },
) {
  const sessionId = nonEmptyString(input.sessionId);
  if (!sessionId) {
    return undefined;
  }

  const [session] = await repository.listDijieDialogSessions(
    {
      id: sessionId,
      account_id: input.accountId,
    },
    { take: 1 },
  );
  return session;
}

async function createOrUpdateSession(
  repository: DialogTurnRepository,
  input: RecordDijieDialogTurnInput,
  occurredAt: Date,
) {
  const existing = await getExistingSession(repository, {
    sessionId: input.sessionId,
    accountId: input.context.accountId,
  });
  if (input.sessionId && !existing) {
    return undefined;
  }
  if (existing) {
    return repository.updateDijieDialogSessions({
      id: existing.id,
      capability_policy: sanitizeDialogStorageValue(
        input.capabilityPolicy,
      ) as DijieDialogCapabilityPolicy,
      last_message_at: occurredAt,
    });
  }

  return repository.createDijieDialogSessions({
    account_id: input.context.accountId,
    account_type: input.context.accountType,
    surface: input.context.surface,
    mode: input.context.mode,
    billing_account_id: input.context.billingAccountId,
    subject: sanitizeDialogStorageValue(input.context.subject) as DijieDialogSubject,
    capability_policy: sanitizeDialogStorageValue(
      input.capabilityPolicy,
    ) as DijieDialogCapabilityPolicy,
    title: safeTitle(input.userMessage),
    last_message_at: occurredAt,
  });
}

export async function recordDijieDialogTurnWithRepository(
  repository: DialogTurnRepository,
  input: RecordDijieDialogTurnInput,
): Promise<RecordDijieDialogTurnResult> {
  const userMessageContent = nonEmptyString(input.userMessage);
  if (!userMessageContent) {
    return { ok: false, status: 400, error: "对话消息不能为空。" };
  }

  const occurredAt = new Date();
  const session = await createOrUpdateSession(repository, input, occurredAt);
  if (!session) {
    return { ok: false, status: 404, error: "未找到当前账号可访问的对话会话。" };
  }

  const ledgerResult = await createDijieLedgerEntryWithRepository(repository, {
    accountId: input.context.accountId,
    billingAccountId: input.context.billingAccountId,
    source: "dialog_usage",
    usageKind: input.assistantReply.modelCalled ? "model_tokens" : "other",
    surface: input.context.surface,
    mode: input.context.mode,
    subject: {
      ...input.context.subject,
      ...(session.id ? { sessionId: session.id } : {}),
    },
    meters: input.assistantReply.modelCalled
      ? [
          { name: "dialog_message", quantity: 1, unit: "message" },
          ...(input.assistantReply.modelUsage
            ? createDijieDialogModelUsageMeters(input.assistantReply.modelUsage)
            : []),
        ]
      : [{ name: "dialog_message", quantity: 1, unit: "message" }],
    ...createDijieDialogLedgerBillingFields(input.assistantReply),
    roleListingId: input.context.subject.roleListingId,
    packageId: input.context.subject.packageId,
    executionId: input.context.subject.executionId,
    entitlementId: input.context.subject.entitlementId,
    occurredAt,
  });
  if (!ledgerResult.ok) {
    return ledgerResult;
  }

  const userMessage = await repository.createDijieDialogMessages({
    session_id: session.id,
    account_id: input.context.accountId,
    message_role: "user",
    content: sanitizeSensitiveText(userMessageContent),
    grounding: null,
    model_called: false,
    model_usage: null,
    ledger_entry_id: null,
    occurred_at: occurredAt,
  });
  const assistantMessage = await repository.createDijieDialogMessages({
    session_id: session.id,
    account_id: input.context.accountId,
    message_role: "assistant",
    content: sanitizeSensitiveText(input.assistantReply.reply),
    grounding: sanitizeDialogStorageValue(
      input.assistantReply.grounding,
    ) as DijieDialogMessageResponse["grounding"],
    model_called: input.assistantReply.modelCalled,
    model_usage: sanitizeDialogStorageValue(input.assistantReply.modelUsage),
    ledger_entry_id: ledgerResult.value.ledgerEntry.id,
    occurred_at: occurredAt,
  });

  return {
    ok: true,
    value: {
      session,
      userMessage,
      assistantMessage,
      ledgerEntry: ledgerResult.value.ledgerEntry,
    },
  };
}

export async function listDijieDialogSessionsForAccountWithRepository(
  repository: DijieDialogSessionLookupRepository,
  input: {
    accountId?: string;
    surface?: DijieDialogSurface;
    take?: number;
  },
): Promise<Array<DijieDialogSessionStorageRecord & { id: string }>> {
  const accountId = nonEmptyString(input.accountId);
  return repository.listDijieDialogSessions(
    {
      ...(accountId ? { account_id: accountId } : {}),
      ...(input.surface ? { surface: input.surface } : {}),
    },
    {
      take: input.take ?? 50,
      order: { last_message_at: "DESC" },
    },
  );
}

export async function retrieveDijieDialogSessionWithMessagesWithRepository(
  repository: DijieDialogSessionLookupRepository & DijieDialogMessageLookupRepository,
  input: {
    sessionId: string;
    accountId?: string;
  },
): Promise<
  | {
      session: DijieDialogSessionStorageRecord & { id: string };
      messages: Array<DijieDialogMessageStorageRecord & { id: string }>;
    }
  | undefined
> {
  const sessionId = nonEmptyString(input.sessionId);
  if (!sessionId) {
    return undefined;
  }
  const [session] = await repository.listDijieDialogSessions(
    {
      id: sessionId,
      ...(input.accountId ? { account_id: input.accountId } : {}),
    },
    { take: 1 },
  );
  if (!session) {
    return undefined;
  }

  const messages = await repository.listDijieDialogMessages(
    { session_id: session.id },
    {
      take: 200,
      order: { occurred_at: "ASC" },
    },
  );
  return { session, messages };
}

function createDijieDialogLedgerBillingFields(reply: DijieDialogMessageResponse) {
  if (!reply.modelCalled || !reply.modelUsage) {
    return {
      grossAmountCents: 0,
      platformReceivableCents: 0,
      developerReceivableCents: 0,
      modelPricingKnown: false,
    };
  }

  const amounts = createDijieDialogModelBillingAmounts(reply.modelUsage);
  return {
    ...amounts,
    modelProvider: reply.modelUsage.provider,
    modelId: reply.modelUsage.model,
    modelPricingKnown: reply.modelUsage.pricing.pricingKnown,
    modelPricingSource: reply.modelUsage.pricing.pricingSource,
    providerCostCents: reply.modelUsage.pricing.providerCostCents,
    providerCostCurrency: reply.modelUsage.pricing.providerCostCurrency,
  };
}

export function createDijieDialogTurnReadModel(input: {
  session: DijieDialogSessionStorageRecord & { id: string };
  userMessage: DijieDialogMessageStorageRecord & { id: string };
  assistantMessage: DijieDialogMessageStorageRecord & { id: string };
  ledgerEntry: DijieLedgerEntryStorageRecord & { id: string };
}) {
  return {
    session: createDijieDialogSessionReadModel(input.session),
    messages: [
      createDijieDialogMessageReadModel(input.userMessage),
      createDijieDialogMessageReadModel(input.assistantMessage),
    ],
    ledgerEntry: createDijieLedgerEntryReadModel(input.ledgerEntry),
  };
}
