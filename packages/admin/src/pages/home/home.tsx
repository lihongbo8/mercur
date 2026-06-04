import { SingleColumnPage } from "../../components/layout/pages"

type ReviewStatus = {
  label: string
  value: string
  tone?: "muted" | "warning" | "success"
}

const reviewStatuses: ReviewStatus[] = [
  { label: "待审核岗位", value: "1", tone: "muted" },
  { label: "材料完整性", value: "待复核", tone: "warning" },
  { label: "安全摘要", value: "未命中敏感项", tone: "success" },
  { label: "价格与计费", value: "待确认", tone: "warning" },
  { label: "审计回读", value: "脱敏", tone: "success" },
  { label: "确认点", value: "2", tone: "muted" },
]

const statusColor = {
  muted: "text-ui-fg-muted",
  warning: "text-orange-500",
  success: "text-green-600",
}

export const Home = () => {
  return (
    <SingleColumnPage hasOutlet={false}>
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
            <div className="flex h-11 items-center gap-x-2 rounded-md border bg-ui-bg-base px-4 shadow-borders-base">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="txt-compact-small-plus text-ui-fg-base">审核模式</span>
            </div>
            <div className="flex h-11 items-center gap-x-2 rounded-md border bg-ui-bg-base px-4 shadow-borders-base">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="txt-compact-small-plus text-ui-fg-base">待审核 1</span>
            </div>
            <div className="flex h-11 items-center gap-x-2 rounded-md border bg-ui-bg-base px-4 shadow-borders-base">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="txt-compact-small-plus text-ui-fg-base">确认点 2</span>
            </div>
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
              {reviewStatuses.map((item) => (
                <div
                  key={item.label}
                  className="flex min-h-[112px] items-center justify-between border-b px-8 last:border-b-0"
                >
                  <span className="txt-medium-plus text-ui-fg-base">{item.label}</span>
                  <span className={`txt-medium-plus ${statusColor[item.tone || "muted"]}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </SingleColumnPage>
  )
}
