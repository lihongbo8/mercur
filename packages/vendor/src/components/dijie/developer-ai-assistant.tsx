import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChatBubbleLeftRight, XMark } from "@medusajs/icons";
import { Button, Container, Heading, IconButton, StatusBadge, Text, Textarea } from "@medusajs/ui";

import {
  fetchLatestDijieRolePackageDraftQuery,
  generateDijieRolePackageDraftQuery,
  sendDijieDeveloperDialogMessageQuery,
} from "@lib/client";

const capabilityPreview = [
  {
    label: "主图巡检 skill",
    value: "generated_candidate",
    title: "由 OpenClaw skill-creator 生成候选，需验收后执行",
  },
  {
    label: "详情页巡检 skill",
    value: "generated_candidate",
    title: "由 OpenClaw skill-creator 生成候选，需验收后执行",
  },
  {
    label: "产品保真自检 skill",
    value: "generated_candidate",
    title: "候选 skill 仍需图片理解和标准产品图 adapter",
  },
  {
    label: "browser / human.confirm / audit.record",
    value: "available",
    title: "OpenClaw / AICS 已有可复用能力",
  },
  {
    label: "image.inspect / image.generate",
    value: "candidate_found",
    title: "OpenClaw provider 候选，需确认本地模型配置",
  },
  {
    label: "商品资料 / 图片资料 / 问题台账 / 设计标准",
    value: "adapter_needed",
    title: "需要 AICS 业务 adapter 接入后才能真实执行",
  },
];

type RolePackageDraftSummary = {
  draftId?: string;
  status?: string;
  packageId?: string | null;
  packageVersion?: string | null;
  fileCount?: number;
  qualityReport?: {
    score?: number;
    ok?: boolean;
    blockingIssues?: string[];
  };
  blockingIssues?: string[];
};

type DeveloperMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

type DialogResponse = {
  message?: {
    content?: string;
  };
};

type DijieRolePackageGenerationErrorData = {
  error?: string;
  issues?: string[];
  diagnostics?: {
    stageId?: string;
    stageLabel?: string;
    replyPreview?: string;
    repairReplyPreview?: string;
  };
};

type NavigationTarget = {
  path: string;
  message: string;
  showCapabilities?: boolean;
};

const createMessageId = () =>
  `devmsg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const initialMessages: DeveloperMessage[] = [
  {
    id: "devmsg_intro",
    role: "assistant",
    text: "说一下你要开发的岗位。复杂岗位请包含业务场景、SOP、skill、工具能力、验收标准和失败标准。",
  },
];

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}分${rest}秒` : `${rest}秒`;
};

const isNavigationIntent = (text: string) =>
  /(打开|进入|查看|去|跳到|回到|返回|带我到|带我去|我要到|我要去|上传|上架).*(开发对话|对话|销售|订单|结算|分账|能力|工具|上传|上架|审核|岗位商品|商品|开发者资料|账户资料|资料)/u.test(text);

const isNegatedGenerationIntent = (text: string) =>
  /(?:不要|不需要|无需|先别|别|勿|禁止).{0,12}(?:生成|创建|开发|输出|写出).{0,12}(?:岗位包|role_package|文件|manifest|skill|sop|template|validation)/u.test(text);

const isGenerationIntent = (text: string) =>
  !isNegatedGenerationIntent(text) &&
  /岗位|role_package|manifest|skill|sop|template|validation|验收|智能体/u.test(text) &&
  /生成|创建|开发|做一个|补|继续|输出|写出|manifest|skill|sop|template|validation/u.test(text);

const isRolePackageDevelopmentSpec = (text: string) =>
  isGenerationIntent(text) &&
  (text.length >= 80 ||
    /业务场景|SOP|sop|验收标准|失败标准|skill\s*要求|requiredCapabilities|manifest\.permissions|请开发一个|岗位开发规格|生成可上传/u.test(
      text
    ));

const getNavigationTarget = (text: string): NavigationTarget | null => {
  if (/(回到|返回|打开|进入|查看|去|跳到|我要到|我要去|带我到|带我去).*(开发对话|对话)/u.test(text)) {
    return {
      path: "/",
      message: "已回到开发对话。",
    };
  }

  if (/(上传|上架|发布).*(岗位|岗位包|role_package|草稿|商品)|岗位包.*(上传|上架|发布)/u.test(text)) {
    return {
      path: "/products/create",
      message:
        "已识别：上传岗位。进入上传岗位页后确认最近岗位包草稿，发布前会停在确认点。",
    };
  }

  if (/(岗位商品|商品).*(审核|状态|上架|管理|列表|查看)|审核.*(岗位|商品|状态)|上架状态/u.test(text)) {
    return {
      path: "/products",
      message: "已进入岗位商品，查看草稿、审核和上架状态。",
    };
  }

  if (/(销售|订单|购买).*(记录|查看|列表|状态)?|订单/u.test(text)) {
    return {
      path: "/orders",
      message: "已进入销售记录。",
    };
  }

  if (/(结算|分账|应收|收款).*(记录|查看|列表|状态)?/u.test(text)) {
    return {
      path: "/payouts",
      message: "已进入结算记录。",
    };
  }

  if (/(能力|工具|资源).*(查看|列表|打开|进入|管理)?/u.test(text)) {
    return {
      path: "/tool-resources",
      message: "已进入能力资源。",
      showCapabilities: true,
    };
  }

  if (/(开发者资料|账户资料|个人资料|资料|地址|主体信息|公司信息).*(查看|编辑|补全|打开|进入|管理)?/u.test(text)) {
    return {
      path: "/settings/profile",
      message: "已进入开发者资料。",
    };
  }

  return null;
};

const CapabilityAcquisitionPanel = () => (
  <div className="rounded-md border bg-ui-bg-base p-4">
    <div className="flex items-center justify-between gap-x-3">
      <div>
        <Text className="txt-compact-medium-plus text-ui-fg-base">能力获取流程</Text>
        <Text className="mt-1 txt-compact-small text-ui-fg-subtle">
          岗位需求先解析 skill / tool / provider / adapter，再生成绑定草案
        </Text>
      </div>
      <StatusBadge color="orange">待验收</StatusBadge>
    </div>
    <div className="mt-4 grid gap-2">
      {capabilityPreview.map((item) => (
        <div
          key={item.label}
          className="flex min-h-[42px] items-center justify-between rounded-md border px-3"
          title={item.title}
        >
          <Text className="txt-compact-small-plus text-ui-fg-base">{item.label}</Text>
          <Text className="txt-compact-small text-ui-fg-subtle">{item.value}</Text>
        </div>
      ))}
    </div>
  </div>
);

const RolePackageDraftPanel = ({ draft }: { draft: RolePackageDraftSummary }) => (
  <div className="rounded-md border bg-ui-bg-base p-4">
    <div className="flex items-center justify-between gap-x-3">
      <div>
        <Text className="txt-compact-medium-plus text-ui-fg-base">岗位包草稿</Text>
        <Text className="mt-1 txt-compact-small text-ui-fg-subtle">
          {draft.packageId ?? draft.draftId ?? "未命名草稿"} · {draft.fileCount ?? 0} 个文件
        </Text>
      </div>
      <StatusBadge color={draft.status === "ready" ? "green" : "orange"}>
        {draft.status === "ready" ? "可上传" : "待处理"}
      </StatusBadge>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <div className="rounded-md border px-3 py-2">
        <Text className="txt-compact-small text-ui-fg-subtle">质量评分</Text>
        <Text className="txt-compact-large-plus text-ui-fg-base">
          {draft.qualityReport?.score ?? 0}
        </Text>
      </div>
      <div className="rounded-md border px-3 py-2">
        <Text className="txt-compact-small text-ui-fg-subtle">版本</Text>
        <Text className="txt-compact-large-plus text-ui-fg-base">
          {draft.packageVersion ?? "-"}
        </Text>
      </div>
      <div className="rounded-md border px-3 py-2">
        <Text className="txt-compact-small text-ui-fg-subtle">阻断项</Text>
        <Text className="txt-compact-large-plus text-ui-fg-base">
          {(draft.blockingIssues ?? draft.qualityReport?.blockingIssues ?? []).length}
        </Text>
      </div>
    </div>
  </div>
);

const formatGenerationErrorMessage = (error: unknown) => {
  const message =
    error instanceof Error && error.message ? error.message : "请确认本地 OpenClaw 模型桥和草稿存储已配置。";
  const data = (error as Error & { data?: DijieRolePackageGenerationErrorData })?.data;
  const details: string[] = [];

  if (data?.issues?.length) {
    details.push(`阻断项：${data.issues.join("；")}`);
  }

  if (data?.diagnostics?.stageLabel || data?.diagnostics?.stageId) {
    details.push(
      `失败阶段：${data.diagnostics.stageLabel ?? data.diagnostics.stageId ?? "未知阶段"}`
    );
  }

  if (data?.diagnostics?.repairReplyPreview || data?.diagnostics?.replyPreview) {
    details.push(
      `模型摘要：${data.diagnostics.repairReplyPreview ?? data.diagnostics.replyPreview}`
    );
  }

  return `AI开发助手暂时无法生成岗位包：${message}${details.length ? `\n${details.join("\n")}` : ""}`;
};

export const DeveloperAiPanel = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<DeveloperMessage[]>(initialMessages);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningMode, setRunningMode] = useState<"dialog" | "generation" | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rolePackageDraft, setRolePackageDraft] = useState<RolePackageDraftSummary | null>(null);

  useEffect(() => {
    let active = true;
    fetchLatestDijieRolePackageDraftQuery()
      .then((result) => {
        const latestDraft = (result as { draft?: RolePackageDraftSummary | null })?.draft ?? null;
        if (active && latestDraft) {
          setRolePackageDraft(latestDraft);
          setMessages((current) => [
            ...current,
            {
              id: createMessageId(),
              role: "system",
              text: `已读取最近岗位包草稿：${latestDraft.packageId ?? latestDraft.draftId ?? "未命名草稿"}，${latestDraft.fileCount ?? 0} 个文件。`,
            },
          ]);
        }
      })
      .catch(() => {
        // The assistant can still operate without a previous draft.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!running || !startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running, startedAt]);

  const stageText = useMemo(() => {
    if (!running) {
      return "待命";
    }
    if (runningMode === "dialog") {
      return "正在调用 OpenClaw 模型回答开发问题。";
    }
    if (elapsedSeconds >= 120) {
      return "模型仍在生成完整岗位包，建议后续拆成规划、skills、templates、validation 分阶段生成。";
    }
    if (elapsedSeconds >= 30) {
      return "已进入长任务生成，正在等待 OpenClaw 模型返回岗位包 JSON。";
    }
    return "正在调用 OpenClaw 模型生成岗位包。";
  }, [elapsedSeconds, running, runningMode]);

  const appendMessage = (message: Omit<DeveloperMessage, "id">) => {
    setMessages((current) => [...current, { id: createMessageId(), ...message }]);
  };

  const runLowRiskAction = (path: string, message: string) => {
    appendMessage({ role: "assistant", text: message });
    navigate(path);
  };

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || running) {
      return;
    }

    appendMessage({ role: "user", text });

    const shouldGenerateRolePackage = isRolePackageDevelopmentSpec(text);
    const navigationTarget = shouldGenerateRolePackage ? null : getNavigationTarget(text);

    if (
      shouldGenerateRolePackage ||
      (isGenerationIntent(text) && !navigationTarget && !isNavigationIntent(text))
    ) {
      const controller = new AbortController();
      setRunning(true);
      setRunningMode("generation");
      setStartedAt(Date.now());
      setShowCapabilities(false);
      appendMessage({
        role: "assistant",
        text: "已收到岗位开发规格，开始生成 role_package 草稿。这个动作会调用模型并做结构、能力和质量校验。",
      });
      try {
        const result = await generateDijieRolePackageDraftQuery(text, controller.signal) as {
          draft?: RolePackageDraftSummary;
        };
        const generatedDraft = result.draft;
        setRolePackageDraft(generatedDraft ?? null);
        appendMessage({
          role: "assistant",
          text: generatedDraft
            ? `已生成岗位包草稿，包含 ${generatedDraft.fileCount ?? 0} 个文件，质量评分 ${generatedDraft.qualityReport?.score ?? 0}。`
            : "已生成岗位包草稿，请到上传岗位页确认。",
        });
      } catch (error) {
        setRolePackageDraft(null);
        appendMessage({
          role: "assistant",
          text: formatGenerationErrorMessage(error),
        });
      } finally {
        setRunning(false);
        setRunningMode(null);
        setStartedAt(null);
        setDraft("");
      }
      return;
    }

    if (navigationTarget) {
      setShowCapabilities(!!navigationTarget.showCapabilities);
      runLowRiskAction(navigationTarget.path, navigationTarget.message);
    } else {
      setShowCapabilities(false);
      setRunning(true);
      setRunningMode("dialog");
      setStartedAt(Date.now());
      try {
        const result = (await sendDijieDeveloperDialogMessageQuery(text)) as DialogResponse;
        appendMessage({
          role: "assistant",
          text:
            result.message?.content ??
            "已记录。低风险导航可以直接执行；发布、改价、结算确认会等待你确认。",
        });
      } catch (error) {
        appendMessage({
          role: "assistant",
          text: `开发助手暂时无法调用模型：${
            error instanceof Error && error.message ? error.message : "请稍后重试。"
          }`,
        });
      } finally {
        setRunning(false);
        setRunningMode(null);
        setStartedAt(null);
      }
    }

    setDraft("");
  };

  return (
    <Container
      className={[
        "grid grid-rows-[auto_minmax(0,1fr)_auto] p-0",
        compact ? "h-[620px]" : "min-h-[560px]",
      ].join(" ")}
    >
      <div className="border-b px-6 py-4">
        <Heading level="h2">开发对话</Heading>
        <Text className="mt-2 text-ui-fg-subtle">讲业务逻辑，发布前停在确认点</Text>
      </div>
      <div className="grid min-h-0 content-start gap-y-4 overflow-y-auto p-6" aria-live="polite">
        <div className="flex items-center justify-between rounded-md border bg-ui-bg-subtle px-4 py-3">
          <Text className="txt-compact-small-plus text-ui-fg-base">{stageText}</Text>
          <StatusBadge color={running ? "orange" : "grey"}>
            {running ? formatElapsed(elapsedSeconds) : "待命"}
          </StatusBadge>
        </div>
        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              "max-w-[640px] rounded-md border px-4 py-3",
              message.role === "user"
                ? "ml-auto border-ui-border-interactive bg-ui-bg-interactive"
                : message.role === "system"
                  ? "bg-ui-bg-base"
                  : "bg-ui-bg-subtle",
            ].join(" ")}
          >
            <Text className="whitespace-pre-wrap text-ui-fg-base">{message.text}</Text>
          </div>
        ))}
        {rolePackageDraft ? <RolePackageDraftPanel draft={rolePackageDraft} /> : null}
        {showCapabilities ? <CapabilityAcquisitionPanel /> : null}
      </div>
      <div className="grid gap-y-3 border-t p-4">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="输入：上传刚生成的岗位包 / 去岗位商品看审核状态 / 查看结算 / 回到开发对话；或输入岗位开发规格"
          rows={compact ? 3 : 4}
          disabled={running}
        />
        <div className="flex items-center justify-between gap-x-3">
          <Text className="txt-compact-small text-ui-fg-subtle">
            {running ? "生成期间可继续观察进度，完成或失败后会保留记录。" : "长规格会作为岗位包生成输入，不会只做关键词导航。"}
          </Text>
          <Button size="small" type="button" onClick={handleSubmit} disabled={!draft.trim() || running}>
            {running ? "生成中" : "发送"}
          </Button>
        </div>
      </div>
    </Container>
  );
};

export const DeveloperAiAssistantDock = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (location.pathname === "/" || location.pathname === "") {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-y-3">
      {open ? (
        <div className="shadow-elevation-flyout w-[520px] max-w-[calc(100vw-40px)] overflow-hidden rounded-lg border bg-ui-bg-base">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <Text className="txt-compact-medium-plus text-ui-fg-base">AI 开发助手</Text>
              <Text className="txt-compact-small text-ui-fg-subtle">当前页面可直接生成岗位包或导航</Text>
            </div>
            <IconButton
              size="small"
              variant="transparent"
              type="button"
              aria-label="关闭 AI 开发助手"
              onClick={() => setOpen(false)}
            >
              <XMark />
            </IconButton>
          </div>
          <DeveloperAiPanel compact />
        </div>
      ) : null}
      <Button
        type="button"
        size="small"
        variant="primary"
        onClick={() => setOpen((value) => !value)}
      >
        <ChatBubbleLeftRight />
        AI 开发助手
      </Button>
    </div>
  );
};
