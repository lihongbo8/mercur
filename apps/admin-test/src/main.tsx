import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider, TooltipProvider } from "@medusajs/ui";
import "@mercurjs/admin/index.css";
import App from "@mercurjs/admin";

const previewItems = [
  "审核中心",
  "审核对话",
  "待审核岗位商品",
  "审核详情",
  "安全摘要",
  "价格检查",
  "对话计费",
  "通过确认",
  "驳回确认",
  "审核记录",
  "审核设置",
];

const reviewStatuses = [
  ["待审核岗位", "1", "text-ui-fg-muted"],
  ["材料完整性", "待复核", "text-orange-500"],
  ["安全摘要", "未命中敏感项", "text-green-600"],
  ["价格与计费", "待确认", "text-orange-500"],
  ["审计回读", "脱敏", "text-green-600"],
  ["确认点", "2", "text-ui-fg-muted"],
];

const ReviewCenterPreview = () => (
  <div className="min-h-[760px]">
    <div className="flex min-h-[72px] items-center justify-between border-b">
      <div className="flex items-center gap-x-3 txt-compact-small-plus">
        <span className="text-ui-fg-muted">迭界AI</span>
        <span className="text-ui-fg-muted">›</span>
        <span className="text-ui-fg-muted">审核中心</span>
        <span className="text-ui-fg-muted">›</span>
        <span className="text-ui-fg-interactive">审核对话</span>
      </div>
      <div className="flex items-center gap-x-3">
        {[
          ["bg-blue-500", "审核模式"],
          ["bg-orange-500", "待审核 1"],
          ["bg-orange-500", "确认点 2"],
        ].map(([dot, label]) => (
          <div key={label} className="flex h-11 items-center gap-x-2 rounded-md border bg-ui-bg-base px-4 shadow-borders-base">
            <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
            <span className="txt-compact-small-plus text-ui-fg-base">{label}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="grid gap-6 py-8" style={{ gridTemplateColumns: "minmax(0, 1fr) 500px" }}>
      <section className="flex min-h-[700px] flex-col overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base">
        <div className="border-b px-8 py-7">
          <h1 className="txt-large-plus text-ui-fg-base">审核对话</h1>
          <p className="mt-3 txt-medium text-ui-fg-subtle">
            前端设计样例，后端真实数据接入后按同一流程推进材料、风险、计费和确认点。
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-y-5 px-8 py-8">
          <div className="max-w-[760px] rounded-lg border bg-ui-bg-subtle px-6 py-5">
            <p className="txt-medium text-ui-fg-subtle">
              管理员已选择待审核岗位：商品图检查岗位。
            </p>
          </div>

          <div className="ml-[74px] max-w-[860px] rounded-lg border border-ui-border-interactive bg-ui-bg-interactive/10 px-6 py-5">
            <p className="txt-medium-plus text-ui-fg-interactive">
              系统提示：先核对公开材料、能力需求、授权价格和脱敏回读，再进入人工确认。
            </p>
          </div>

          <div className="max-w-[900px] rounded-lg border bg-ui-bg-subtle px-6 py-5">
            <p className="txt-medium text-ui-fg-subtle">
              审核检查：围绕同一个待审核岗位，依次核对公开材料、安全摘要、价格计费和确认点。
            </p>
          </div>

          <div className="grid max-w-[900px] grid-cols-3 gap-4">
            {[
              ["公开材料", "介绍、场景、文案、分类。"],
              ["安全摘要", "能力需求、敏感字段、审计回读。"],
              ["价格确认", "授权费、模型计费、确认点。"],
            ].map(([title, description]) => (
              <div key={title} className="min-h-[138px] rounded-lg border bg-ui-bg-base px-5 py-6 shadow-borders-base">
                <div className="txt-medium-plus whitespace-nowrap text-ui-fg-base">{title}</div>
                <p className="mt-3 txt-compact-small text-ui-fg-subtle">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-x-4 border-t px-6 py-4">
          <input
            className="h-12 rounded-lg border bg-ui-bg-base px-4 txt-compact-small text-ui-fg-base outline-none placeholder:text-ui-fg-muted focus:border-ui-border-interactive"
            placeholder="输入审核问题，例如：看商品图检查岗位的计费和风险"
            type="text"
          />
          <button className="h-12 rounded-lg bg-ui-fg-base px-6 txt-compact-small-plus text-ui-bg-base">
            发送
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border bg-ui-bg-base shadow-borders-base">
        <div className="border-b px-8 py-7">
          <h2 className="txt-large-plus text-ui-fg-base">审核状态</h2>
          <p className="mt-3 txt-medium text-ui-fg-subtle">
            照开发者中心状态面板，只放当前判断。
          </p>
        </div>
        <div>
          {reviewStatuses.map(([label, value, color]) => (
            <div
              key={label}
              className="flex min-h-[112px] items-center justify-between border-b px-8 last:border-b-0"
            >
              <span className="txt-medium-plus text-ui-fg-base">{label}</span>
              <span className={`txt-medium-plus ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
);

const AdminPreview = () => (
  <TooltipProvider>
    <I18nProvider>
      <BrowserRouter basename="/dashboard">
        <div
          className="min-h-screen bg-ui-bg-subtle text-ui-fg-base"
          style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)" }}
        >
          <aside className="border-r bg-ui-bg-subtle px-11 py-9">
            <div className="mb-12 flex items-center gap-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ui-bg-base txt-large-plus shadow-borders-base">
                审
              </div>
              <div>
                <div className="txt-large-plus">迭界AI</div>
                <div className="txt-medium text-ui-fg-subtle">审核中心</div>
              </div>
            </div>
            <nav className="flex flex-col gap-y-4">
              {previewItems.map((item) => (
                <div
                  key={item}
                  className="rounded-lg px-4 py-3 txt-medium-plus text-ui-fg-subtle first:bg-ui-bg-base first:text-ui-fg-base first:shadow-borders-base"
                >
                  {item}
                </div>
              ))}
            </nav>
          </aside>
          <main className="px-10 py-0">
            <ReviewCenterPreview />
          </main>
        </div>
      </BrowserRouter>
    </I18nProvider>
  </TooltipProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname.endsWith("/preview-home") ? (
      <AdminPreview />
    ) : (
      <App />
    )}
  </StrictMode>,
);
