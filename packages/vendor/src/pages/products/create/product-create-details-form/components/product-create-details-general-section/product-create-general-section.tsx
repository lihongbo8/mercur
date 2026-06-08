import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Input,
  StatusBadge,
  Text,
  Textarea,
  Tooltip,
} from "@medusajs/ui";
import {
  CheckCircle,
  CloudArrowUp,
  ExclamationCircle,
  InformationCircle,
} from "@medusajs/icons";

import { Form } from "@components/common/form";
import { useTabbedForm } from "@components/tabbed-form";
import {
  fetchLatestDijieRolePackageDraftQuery,
  submitDijieRolePackageDraftQuery,
  uploadDijieRolePackageQuery,
} from "@lib/client";
import { ProductCreateSchemaType } from "../../../types";

const ROLE_PACKAGE_UPLOAD_ERROR_MESSAGE =
  "资料包安全检查未通过，请回到主系统重新生成后再上传。";
const ROLE_PACKAGE_REQUIRED_MESSAGE = "请先上传岗位资料包。";
const ROLE_PACKAGE_INVALID_MESSAGE = "岗位资料包无法用于上架，请重新上传。";
const PLATFORM_TOKEN_PRICE_HINT =
  "开发者可自行定价；提交时后端会按平台成本和上限倍率做硬限制。";

const ROLE_PACKAGE_STATUS_COLOR = {
  检查中: "orange",
  需处理: "red",
  已就绪: "green",
  待上传: "grey",
} as const;

const ROLE_PACKAGE_STEPS = [
  "上传资料包",
  "安全检查",
  "身份回填",
  "等待确认",
] as const;

type RolePackageStatus = keyof typeof ROLE_PACKAGE_STATUS_COLOR;

type DeveloperModeStatusProps = {
  ready: boolean;
  running: boolean;
};

type RolePackageDraftSummary = {
  draftId?: string;
  status?: string;
  packageId?: string | null;
  packageVersion?: string | null;
  fileCount?: number;
  manifestSummary?: {
    name?: string;
    title?: string;
    manifestRef?: string;
    requiredCapabilities?: string[];
  } | null;
  qualityReport?: {
    score?: number;
    ok?: boolean;
  };
  blockingIssues?: string[];
};

const centsPerMillionHint = (value: unknown, baselineCents: number) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return `未填写不能提交；平台成本基线为 ${baselineCents} 分/百万 Token。`;
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return "请输入整数分/百万 Token。";
  }
  return `${amount} 分/百万 Token = ¥${(amount / 100).toFixed(2)}/百万 Token。`;
};

const DeveloperModeStatus = ({ ready, running }: DeveloperModeStatusProps) => {
  const status = running ? "同步中" : ready ? "可提交" : "待资料包";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-4 py-3 shadow-elevation-card-rest md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-y-1">
        <div className="flex items-center gap-x-2">
          <Text size="small" weight="plus">
            开发者模式
          </Text>
          <StatusBadge color={ready ? "green" : running ? "orange" : "grey"}>
            {status}
          </StatusBadge>
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          只描述岗位要完成的业务逻辑，资料包由主系统生成后上传。
        </Text>
      </div>
      <Button size="small" variant="secondary" asChild>
        <Link to="/products" title="查看岗位商品状态">
          查看状态
        </Link>
      </Button>
    </div>
  );
};

const LatestRolePackageDraftPanel = ({
  draft,
  running,
  onUseDraft,
}: {
  draft: RolePackageDraftSummary | null;
  running: boolean;
  onUseDraft: () => void;
}) => {
  if (!draft) {
    return null;
  }

  const blockingCount = draft.blockingIssues?.length ?? 0;
  const ready = draft.status === "ready" && blockingCount === 0;
  const submitted = draft.status === "submitted";
  const blocked = draft.status === "blocked" || blockingCount > 0;
  const statusLabel = ready
    ? "可承接"
    : submitted
      ? "已承接"
      : blocked
        ? "需修复"
        : "生成中";
  const statusColor = ready
    ? "green"
    : submitted
      ? "grey"
      : blocked
        ? "red"
        : "orange";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-base px-4 py-3 shadow-elevation-card-rest md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-y-1">
        <div className="flex items-center gap-x-2">
          <Text size="small" weight="plus">
            AI 生成岗位包草稿
          </Text>
          <StatusBadge color={statusColor}>{statusLabel}</StatusBadge>
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {draft.packageId ?? draft.draftId} · {draft.fileCount ?? 0} 个文件 ·
          质量评分 {draft.qualityReport?.score ?? 0}
        </Text>
      </div>
      <Button
        size="small"
        variant="secondary"
        type="button"
        disabled={!ready || running}
        onClick={onUseDraft}
      >
        {running ? "承接中" : "承接草稿"}
      </Button>
    </div>
  );
};

const RolePackageUploadPanel = ({
  disabled,
  message,
  messageClass,
  ready,
  running,
  status,
  onUpload,
}: {
  disabled: boolean;
  message: string;
  messageClass: string;
  ready: boolean;
  running: boolean;
  status: RolePackageStatus;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) => {
  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest">
      <div className="flex items-start justify-between gap-4 border-b border-ui-border-base px-4 py-3">
        <div className="flex min-w-0 flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            <Text size="small" weight="plus">
              岗位资料包
            </Text>
            <Tooltip content="只接收主系统导出的公开资料包；不会展示原始内容。">
              <InformationCircle className="text-ui-fg-muted" />
            </Tooltip>
          </div>
          <Text size="xsmall" className={messageClass}>
            {running ? "正在检查岗位资料包。" : message}
          </Text>
        </div>
        <StatusBadge color={ROLE_PACKAGE_STATUS_COLOR[status]}>
          {status}
        </StatusBadge>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-4">
        {ROLE_PACKAGE_STEPS.map((step, index) => {
          const complete = ready && index < 3;
          const active = running && index === 1;
          return (
            <div
              key={step}
              className="flex min-h-12 items-center gap-x-2 rounded-md border border-ui-border-base bg-ui-bg-subtle px-3"
            >
              {complete ? (
                <CheckCircle className="text-ui-tag-green-icon" />
              ) : active ? (
                <InformationCircle className="text-ui-tag-orange-icon" />
              ) : (
                <span className="flex size-4 rounded-full border border-ui-border-strong" />
              )}
              <Text size="small" weight="plus">
                {step}
              </Text>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-ui-border-base px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-x-2 text-ui-fg-subtle">
          {status === "需处理" ? (
            <ExclamationCircle className="text-ui-tag-red-icon" />
          ) : (
            <CloudArrowUp />
          )}
          <Text size="small">上传后只显示检查状态和上架所需摘要。</Text>
        </div>
        <Button size="small" variant="secondary" asChild disabled={disabled}>
          <label className="cursor-pointer">
            {running ? "检查中" : ready ? "重新上传" : "选择资料包"}
            <input
              className="sr-only"
              type="file"
              multiple
              {...({ webkitdirectory: "", directory: "" } as Record<
                string,
                string
              >)}
              disabled={disabled}
              onChange={onUpload}
            />
          </label>
        </Button>
      </div>
    </div>
  );
};

export const ProductCreateGeneralSection = () => {
  const form = useTabbedForm<ProductCreateSchemaType>();
  const [rolePackageUpload, setRolePackageUpload] = useState<{
    running: boolean;
    message?: string;
    error?: string;
  }>({ running: false });
  const [latestDraft, setLatestDraft] =
    useState<RolePackageDraftSummary | null>(null);
  const [draftSubmitRunning, setDraftSubmitRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchLatestDijieRolePackageDraftQuery()
      .then((result) => {
        if (!cancelled) {
          setLatestDraft(
            (result as { draft?: RolePackageDraftSummary | null })?.draft ??
              null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLatestDraft(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rolePackageReady = Boolean(
    form.watch("role_package_id") && form.watch("role_package_version"),
  );
  const roleRequiredCapabilities = (
    form.watch("role_required_capabilities") || ""
  )
    .split(/[\n,]/)
    .map((capability) => capability.trim())
    .filter(Boolean);
  const rolePackageValidationError =
    form.formState.errors.role_package_id ||
    form.formState.errors.role_package_version ||
    form.formState.errors.role_manifest_ref;
  const rolePackageMessage =
    rolePackageUpload.error ||
    (rolePackageValidationError
      ? form.formState.errors.role_manifest_ref
        ? ROLE_PACKAGE_INVALID_MESSAGE
        : ROLE_PACKAGE_REQUIRED_MESSAGE
      : rolePackageUpload.message ||
        (rolePackageReady
          ? roleRequiredCapabilities.length > 0
            ? `资料包已就绪，已同步 ${roleRequiredCapabilities.length} 项本地能力需求。`
            : "资料包已就绪。"
          : "上传主系统导出的岗位资料包。"));
  const rolePackageStatus: RolePackageStatus = rolePackageUpload.running
    ? "检查中"
    : rolePackageUpload.error || rolePackageValidationError
      ? "需处理"
      : rolePackageReady
        ? "已就绪"
        : "待上传";
  const rolePackageMessageClass =
    rolePackageUpload.error || rolePackageValidationError
      ? "text-ui-fg-error"
      : "text-ui-fg-subtle";

  const handleRolePackageUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    if (selectedFiles.length === 0 || rolePackageUpload.running) {
      return;
    }

    setRolePackageUpload({ running: true });
    try {
      const files = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileWithDirectory = file as File & {
            webkitRelativePath?: string;
          };
          const path =
            fileWithDirectory.webkitRelativePath || `role_package/${file.name}`;

          return {
            path,
            sizeBytes: file.size,
            content: await file.text(),
          };
        }),
      );
      const result = await uploadDijieRolePackageQuery(files);
      const uploadedPackage = (result as any)?.package;
      if (!uploadedPackage?.packageId || !uploadedPackage?.packageVersion) {
        throw new Error("岗位包上传返回不完整");
      }

      form.setValue("role_package_id", uploadedPackage.packageId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("role_package_version", uploadedPackage.packageVersion, {
        shouldDirty: true,
        shouldValidate: true,
      });
      const manifestRef = uploadedPackage.manifestSummary?.manifestRef;
      if (manifestRef) {
        form.setValue("role_manifest_ref", manifestRef, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      const requiredCapabilities =
        uploadedPackage.manifestSummary?.requiredCapabilities;
      const normalizedRequiredCapabilities = Array.isArray(requiredCapabilities)
        ? requiredCapabilities
            .filter(
              (capability): capability is string =>
                typeof capability === "string",
            )
            .map((capability) => capability.trim())
            .filter(Boolean)
        : [];
      if (Array.isArray(requiredCapabilities)) {
        form.setValue(
          "role_required_capabilities",
          normalizedRequiredCapabilities.join("\n"),
          {
            shouldDirty: true,
            shouldValidate: true,
          },
        );
      }
      const manifestTitle =
        uploadedPackage.manifestSummary?.name?.trim() ||
        uploadedPackage.manifestSummary?.title?.trim();
      if (!form.getValues("title")?.trim() && manifestTitle) {
        form.setValue("title", manifestTitle, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      form.setValue("role_listing_id", "", {
        shouldDirty: true,
        shouldValidate: false,
      });
      setRolePackageUpload({
        running: false,
        message:
          normalizedRequiredCapabilities.length > 0
            ? `资料包已就绪，已同步 ${normalizedRequiredCapabilities.length} 项本地能力需求。请继续确认商品信息后手动提交审核。`
            : "资料包已就绪。请继续确认商品信息后手动提交审核。",
      });
    } catch {
      setRolePackageUpload({
        running: false,
        error: ROLE_PACKAGE_UPLOAD_ERROR_MESSAGE,
      });
    } finally {
      event.currentTarget.value = "";
    }
  };

  const handleUseLatestDraft = async () => {
    if (!latestDraft?.draftId || draftSubmitRunning) {
      return;
    }

    setDraftSubmitRunning(true);
    setRolePackageUpload({ running: true });
    try {
      const result = (await submitDijieRolePackageDraftQuery(
        latestDraft.draftId,
      )) as {
        packageId?: string;
        packageVersion?: string;
      };
      if (!result.packageId || !result.packageVersion) {
        throw new Error("岗位包草稿提交返回不完整");
      }
      form.setValue("role_package_id", result.packageId, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("role_package_version", result.packageVersion, {
        shouldDirty: true,
        shouldValidate: true,
      });
      const manifestRef = latestDraft.manifestSummary?.manifestRef;
      if (manifestRef) {
        form.setValue("role_manifest_ref", manifestRef, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      const requiredCapabilities =
        latestDraft.manifestSummary?.requiredCapabilities ?? [];
      form.setValue(
        "role_required_capabilities",
        requiredCapabilities.join("\n"),
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
      const manifestTitle =
        latestDraft.manifestSummary?.name?.trim() ||
        latestDraft.manifestSummary?.title?.trim();
      if (!form.getValues("title")?.trim() && manifestTitle) {
        form.setValue("title", manifestTitle, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      form.setValue("role_listing_id", "", {
        shouldDirty: true,
        shouldValidate: false,
      });
      setRolePackageUpload({
        running: false,
        message:
          requiredCapabilities.length > 0
            ? `AI 草稿已承接，已同步 ${requiredCapabilities.length} 项本地能力需求。请继续确认商品信息后手动提交审核。`
            : "AI 草稿已承接。请继续确认商品信息后手动提交审核。",
      });
      setLatestDraft({ ...latestDraft, status: "submitted" });
    } catch {
      setRolePackageUpload({
        running: false,
        error: "AI 草稿承接失败，请重新生成或手动上传岗位资料包。",
      });
    } finally {
      setDraftSubmitRunning(false);
    }
  };

  return (
    <div id="general" className="flex flex-col gap-y-6">
      <LatestRolePackageDraftPanel
        draft={latestDraft}
        running={draftSubmitRunning}
        onUseDraft={handleUseLatestDraft}
      />
      <div className="flex flex-col gap-y-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Field
            control={form.control}
            name="title"
            render={({ field }) => {
              return (
                <Form.Item>
                  <Form.Label>岗位名称</Form.Label>
                  <Form.Control>
                    <Input {...field} placeholder="例如：客户线索质检专员" />
                  </Form.Control>
                  <Form.ErrorMessage>
                    {form.formState.errors.title?.message}
                  </Form.ErrorMessage>
                </Form.Item>
              );
            }}
          />
          <Form.Field
            control={form.control}
            name="subtitle"
            render={({ field }) => {
              return (
                <Form.Item>
                  <Form.Label optional>一句话定位</Form.Label>
                  <Form.Control>
                    <Input
                      {...field}
                      placeholder="说明这个岗位适合解决什么业务问题"
                    />
                  </Form.Control>
                </Form.Item>
              );
            }}
          />
          <Form.Field
            control={form.control}
            name="handle"
            render={({ field }) => (
              <input {...field} type="hidden" value={field.value ?? ""} />
            )}
          />
        </div>
      </div>
      <Form.Field
        control={form.control}
        name="description"
        render={({ field }) => {
          return (
            <Form.Item>
              <Form.Label optional>业务说明</Form.Label>
              <Form.Control>
                <Textarea
                  {...field}
                  placeholder="用开发者自己的语言说明岗位会处理哪些输入、输出什么结果。"
                />
              </Form.Control>
            </Form.Item>
          );
        }}
      />
      <Form.Field
        control={form.control}
        name="role_usage_instructions"
        render={({ field }) => {
          return (
            <Form.Item>
              <Form.Label>使用规范</Form.Label>
              <Form.Control>
                <Textarea
                  {...field}
                  placeholder="说明使用者在使用窗口需要提供哪些资料、怎么描述任务、哪些情况会失败或需要人工确认。例如：美工岗位需要上传商品图/详情页素材，说明品牌、卖点、平台规则、目标风格、禁用元素和确认标准。"
                />
              </Form.Control>
              <Text size="xsmall" className="text-ui-fg-subtle">
                这段会显示在商城详情和使用者岗位详情里，也会进入审核中心检查。
              </Text>
              <Form.ErrorMessage>
                {form.formState.errors.role_usage_instructions?.message}
              </Form.ErrorMessage>
            </Form.Item>
          );
        }}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Form.Field
          control={form.control}
          name="role_package_id"
          render={({ field }) => (
            <input {...field} type="hidden" value={field.value ?? ""} />
          )}
        />
        <Form.Field
          control={form.control}
          name="role_package_version"
          render={({ field }) => (
            <input {...field} type="hidden" value={field.value ?? ""} />
          )}
        />
        <Form.Field
          control={form.control}
          name="role_listing_id"
          render={({ field }) => (
            <input {...field} type="hidden" value={field.value ?? ""} />
          )}
        />
        <Form.Field
          control={form.control}
          name="role_manifest_ref"
          render={({ field }) => (
            <input {...field} type="hidden" value={field.value ?? ""} />
          )}
        />
        <Form.Field
          control={form.control}
          name="role_required_capabilities"
          render={({ field }) => (
            <input {...field} type="hidden" value={field.value ?? ""} />
          )}
        />
        <div className="md:col-span-2">
          <RolePackageUploadPanel
            disabled={rolePackageUpload.running}
            message={rolePackageMessage}
            messageClass={rolePackageMessageClass}
            ready={rolePackageReady}
            running={rolePackageUpload.running}
            status={rolePackageStatus}
            onUpload={handleRolePackageUpload}
          />
        </div>
        <div className="md:col-span-2">
          <DeveloperModeStatus
            ready={rolePackageReady}
            running={rolePackageUpload.running}
          />
        </div>
        <Form.Field
          control={form.control}
          name="role_authorization_fee_yuan"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label>授权费（元）</Form.Label>
                <Form.Control>
                  <Input {...field} inputMode="decimal" placeholder="299.00" />
                </Form.Control>
                <Form.ErrorMessage>
                  {form.formState.errors.role_authorization_fee_yuan?.message}
                </Form.ErrorMessage>
              </Form.Item>
            );
          }}
        />
        <Form.Field
          control={form.control}
          name="role_input_token_price_cents_per_million"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label>输入 Token 使用费（分/百万 Token）</Form.Label>
                <Form.Control>
                  <Input {...field} inputMode="numeric" placeholder="120" />
                </Form.Control>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {centsPerMillionHint(field.value, 120)}
                  {PLATFORM_TOKEN_PRICE_HINT}
                </Text>
                <Form.ErrorMessage>
                  {
                    form.formState.errors
                      .role_input_token_price_cents_per_million?.message
                  }
                </Form.ErrorMessage>
              </Form.Item>
            );
          }}
        />
        <Form.Field
          control={form.control}
          name="role_output_token_price_cents_per_million"
          render={({ field }) => {
            return (
              <Form.Item>
                <Form.Label>输出 Token 使用费（分/百万 Token）</Form.Label>
                <Form.Control>
                  <Input {...field} inputMode="numeric" placeholder="360" />
                </Form.Control>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {centsPerMillionHint(field.value, 360)}
                  消费者端会明码展示并按实际用量结算。
                </Text>
                <Form.ErrorMessage>
                  {
                    form.formState.errors
                      .role_output_token_price_cents_per_million?.message
                  }
                </Form.ErrorMessage>
              </Form.Item>
            );
          }}
        />
      </div>
      <Form.Field
        control={form.control}
        name="role_capabilities"
        render={({ field }) => (
          <input {...field} type="hidden" value={field.value ?? ""} />
        )}
      />
    </div>
  );
};
