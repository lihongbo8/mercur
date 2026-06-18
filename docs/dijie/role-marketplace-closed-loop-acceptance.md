# 迭界AI岗位市场主闭环验收

Last updated: 2026-06-11

## Goal

本验收只证明岗位市场主业务链路已经稳定到可以作为“记忆盒子”下一阶段的底座。验收通过不代表记忆盒子、推荐算法、多岗位排序、Graphiti/Mem0/Letta、新支付系统或多开发者分账已经实现。

目标闭环：

开发者生成岗位包 -> Skill/Tool/能力目录审核 -> 创建岗位商品 -> 提交平台审核 -> 审核通过 -> 上架 -> 用户看到岗位 -> 授权/支付 -> 发起执行 -> 产出结果 -> audit/ledger/artifact/readback 可查。

标准 fixture：

- 岗位名称：智能门锁电商美工岗位
- 典型任务：基于智能门锁商品资料生成电商主图/详情页文案/素材检查结果
- 必须覆盖能力：商品素材理解、图片规格标准、日常工作 SOP、验收标准、失败处理、需要平台目录审核的 skill/tool/capability gap

## Out Of Scope

本轮不做：

- 记忆盒子实现
- 推荐算法
- 多岗位复杂排序
- Graphiti/Mem0/Letta 集成
- 新支付系统
- 多开发者分账扩展
- 平台代付型外部 API 池和全量工具/skill 自动下载系统

## State Machine

### Role Package Draft

真实字段：`dijie_role_package_draft.draft_status`

| State | Meaning | Allowed next step | Hard guard |
| --- | --- | --- | --- |
| `partial` | AI 已保存草稿但文件/质量/能力材料未齐 | 继续生成或人工补齐 | 不能提交成正式岗位包 |
| `blocked` | 生成结果存在阻断项，例如缺少目录能力或质量问题 | 修复阻断项或等待目录审核 | 不能提交成正式岗位包 |
| `ready` | 草稿文件、质量报告、能力报告满足提交条件 | `POST /vendor/dijie/role-packages/drafts/:draftId/submit` | 提交前仍需确认 catalog binding 未退回 |
| `submitted` | 已提交成正式岗位包 | 作为 role listing 的 package 来源 | 不应再作为待编辑草稿 |

### Catalog Review

真实字段：

- `dijie_catalog_review_request.review_status`
- `dijie_catalog_item.catalog_status`

| Object | State | Meaning | Hard guard |
| --- | --- | --- | --- |
| review request | `pending_review` | Skill/Tool/MCP/adapter/capability 等待平台审核 | 岗位包只能声明需求，不能当作平台已可用能力 |
| review request | `approved` | 审核通过，可进入目录或作为绑定依据 | 仍要保留权限、风险、来源记录 |
| review request | `rejected` | 审核拒绝 | 依赖它的岗位包/岗位商品不能伪装成能力已满足 |
| review request | `request_changes` | 要求补材料 | 不能当作 approved |
| catalog item | `approved` | 平台可用目录项 | 岗位执行时才能作为已批准能力绑定 |
| catalog item | `disabled` | 曾存在但被禁用 | 不能作为新执行可用能力 |

### Role Listing

真实字段是两条线，不是单字段状态：

- `dijie_role_listing.listing_status`: `draft / proposed / published / delisted / archived`
- `dijie_role_listing.review_state`: `draft / submitted / needs_changes / approved / rejected`

| Business stage | Required state | Allowed next step | Hard guard |
| --- | --- | --- | --- |
| 商品草稿 | `listing_status=draft`, `review_state=draft` | 编辑、提交审核 | 未提交审核不能上架 |
| 已提交平台审核 | `listing_status=proposed`, `review_state=submitted` | 审核员保存三项评估并 finalize | 开发者不能绕过平台审核 |
| 要求修改 | `listing_status=draft`, `review_state=needs_changes` | 修改后重新提交 | 不能上架 |
| 审核通过但未上架 | `listing_status=delisted`, `review_state=approved` | 发布 | 买家不可见，不可新授权；重新发布前必须绑定 approved 平台品类和基础品类包 |
| 已上架 | `listing_status=published`, `review_state=approved` | 买家可见、可授权/支付、可下架 | 只有这个组合且品类包门禁完整时进入公开商城 |
| 已下架 | `listing_status=delisted`, `review_state=approved` | 可重新发布 | 不允许新用户购买；历史授权、执行、账单、审计仍可读；缺品类包绑定不能重新发布 |
| 已驳回/归档 | `listing_status=archived`, `review_state=rejected` | 不能发布 | 不能重新当作已批准商品 |

上架硬门槛：

- 岗位必须绑定 approved 平台品类。
- 平台品类必须绑定基础品类包：`categoryPackRef`、`skillPackRef`、`toolPackRef` 和平台 catalog refs。
- 岗位包里只能描述岗位业务块，不得携带 `requiredSkills`、`requiredTools`、`specialCapabilityRequests`、Skill/Tool 实现、adapter、MCP server、provider key 或本地路径。
- 超出基础品类包的能力必须走独立特殊能力包申请；只有 approved 且开发者显式绑定到岗位后，才能进入岗位 read-model。
- 云端只验证品类引用、能力引用和审核事实；本地安装、启用、密钥/OAuth/MCP 配置仍由 OpenClaw 执行前检查。
- 缺少 approved 平台品类或基础品类包绑定时，平台审核不能 finalize `approved`，开发者也不能 publish。
- 旧数据只允许作为检查结果暴露：`published/approved` 或 `delisted/approved` 但缺 approved 品类包绑定的岗位必须列入 legacy issue，不能自动伪装成新规范已满足。

### User Authorization

真实持久状态：`dijie_role_entitlement.entitlement_status`

| State/code | Type | Meaning | Hard guard |
| --- | --- | --- | --- |
| `checkout_required` | API error code | 需要走付费 checkout 或补齐订单事实 | 不能创建 authorized entitlement |
| `authorized` | persisted status | 用户已授权该岗位 | 可执行，但仍要检查岗位、包、目录能力、scope |
| `revoked` | persisted status | 授权撤销 | 不能发起新执行；历史记录仍可读 |

### Execution, Audit, Ledger, Artifact

执行接口以 `DijieRoleResult.status` 表示执行结果，审计记录以 `dijie_audit_record.status` 持久化。

| State/reason | Meaning | Hard guard |
| --- | --- | --- |
| `completed` | 成功产出业务结果和 artifact | 必须有 audit readback 和 ledger 派生事实 |
| `failed/input_required` | 缺少必要输入 | 不能伪装成功，不能创建成功 ledger |
| `failed/capability_missing` | 缺所需能力或能力被禁用 | 不能伪装成功，错误原因必须可安全读回 |
| `failed/no_artifact` | 未产出业务 artifact | 不能记为成功 |
| audit `failed` | 本地/云端记录了失败 | 仍必须能读到脱敏失败摘要 |
| ledger `role_usage` | 成功执行产生开发者应收账 | 金额、meter、entitlement、execution 必须可追溯 |

## API Closed Loop Checklist

每次验收都使用同一组账号和 fixture，并把返回 id 写入 Evidence Sheet。

| Step | Endpoint | Expected state/evidence |
| --- | --- | --- |
| 1 | `POST /vendor/dijie/role-packages/generate` | 返回草稿；草稿状态只能是 `partial / blocked / ready`；模型使用量可追踪 |
| 2 | `GET /vendor/dijie/role-packages/drafts/latest` | 可读回最新草稿、质量报告、能力报告、catalog review requests |
| 3 | `POST /vendor/dijie/special-capability-requests` | 开发者可对超出基础品类包的能力提交独立申请；请求只保存业务诉求、品类/岗位引用和审核事实 |
| 4 | `GET /admin/dijie/catalog-review` | 审核员能看到待审核 skill/tool/capability gap 和特殊能力包申请 |
| 5 | `POST /admin/dijie/catalog-review/:reviewId/finalize` | `approved/rejected/request_changes` 生效；approved 只代表平台审核通过，不自动进入岗位 read-model |
| 6 | `POST /vendor/dijie/special-capability-requests/:reviewId/bind` | 只有 approved 特殊能力包申请可由原开发者绑定到自己的岗位商品；绑定后才进入 OpenClaw read-model |
| 7 | `POST /vendor/dijie/role-packages/drafts/:draftId/submit` | 只有 `ready` 且 catalog binding 可用的草稿能变正式岗位包 |
| 8 | `POST /vendor/dijie/role-listings` | 创建 `draft/draft` 岗位商品；定价、能力、包引用、使用规范必填 |
| 9 | `POST /vendor/dijie/role-listings/:roleListingId/submit-review` | 商品进入 `proposed/submitted` |
| 10 | `POST /admin/dijie/reviews/:reviewId/evaluations` | 岗位标准、安全合规、定价合理性三项可保存 |
| 11 | `POST /admin/dijie/reviews/:reviewId/finalize` | 三项评估通过且 Skill/Tool 能力对接信息完整时，`approved` 后商品变 `delisted/approved`；`needs_changes` 退回 `draft/needs_changes`；`rejected` 变 `archived/rejected` |
| 12 | `POST /vendor/dijie/role-listings/:roleListingId/publish` | 只有 `review_state=approved` 且 Skill/Tool 能力对接信息完整可发布；发布后 `published/approved` |
| 13 | `GET /dijie/roles` and `GET /dijie/roles/:roleListingId` | 买家只能看到 `published/approved` 的公开岗位 |
| 14 | `POST /dijie/authorizations` | 免费岗位直接 `authorized`；付费岗位必须有有效 paid order，否则返回 `checkout_required` |
| 15 | `GET /dijie/my-roles` or gateway read model | 使用者能看到已授权岗位；未授权不出现假卡片；gateway read-model 只合并已绑定的特殊能力包 |
| 16 | `POST /dijie/executions` | 授权后可执行；完成时生成 result、audit、artifact、role usage ledger |
| 17 | `POST /dijie/audit` | 本地执行上传审计可持久化；失败上传也能安全记录 |
| 18 | `GET /dijie/executions/:executionId` | 使用者可读脱敏结果、失败原因、artifact summary；越权方不能读 |
| 19 | `GET /dijie/ledger/entries` | 授权费和成功执行费用可追踪；历史记录不因下架丢失 |
| 20 | `POST /vendor/dijie/role-listings/:roleListingId/delist` | 下架后不再公开销售；历史授权、执行、ledger、audit 仍可读 |

## Failure Chain Checklist

这些失败场景必须至少跑一次。通过标准不是“返回某个中文错误”，而是不能越权、不能状态乱跳、不能伪成功。

| Scenario | Expected result | Coverage target |
| --- | --- | --- |
| 未登录开发者生成/提交岗位包 | `401/403`，无草稿提交 | API route test + UI smoke |
| `partial` draft submit | `409/400`，不产生正式 package | API route test |
| `blocked` draft submit | `409/400`，不产生正式 package | API route test |
| catalog review 未通过 | 不得把能力当作 approved binding | API route test |
| 特殊能力包 approved 但未绑定 | 不得进入 OpenClaw read-model | read-model test |
| Skill/Tool 能力对接信息缺失 | 审核不能通过，已审核未上架岗位不能发布 | API/store/read-model test |
| 未提交审核的岗位 publish | `409` | API/store test |
| 审核未通过的岗位 publish | `409` | API/store test |
| 下架岗位新用户购买/授权 | 不可新授权；公开商城不可见 | API + UI smoke |
| 未授权用户执行岗位 | `401/403/404` 或业务 `not_authorized`，无成功 artifact | API route test |
| 缺 requiredCapabilities | `failed/capability_missing`，不伪成功 | API route test |
| 缺必要输入 | `failed/input_required`，不伪成功 | API route test |
| 执行失败 readback | 可读脱敏失败原因 | API route test |
| vendor 读取 buyer execution | 拒绝越权 | API route test |
| completed audit 缺 artifact | 拒绝或转失败，不生成成功 ledger | API route test |
| ledger readback | 只能读到自己账户或授权范围内账目 | API route test |

## Four Role UI Smoke

后端 API 绿后再跑 UI。UI smoke 只验证业务动作和状态是否连得上，不以视觉精修为目标。

### Developer

- 进入开发者中心普通对话/岗位生成入口。
- 用 fixture 描述岗位职责、日常管理、业务标准、图片标准、验收标准。
- 看到草稿状态：`partial / blocked / ready`。
- 对 `ready` 草稿执行提交。
- 创建岗位商品，确认包引用、定价、能力需求、使用规范。
- 提交平台审核。
- 审核通过后执行上架/下架，并确认状态变化。

### Admin Reviewer

- 进入审核中心。
- 看到 catalog review 队列和 role review 队列。
- 对 Skill/Tool/能力目录审核执行 approve/reject/request changes。
- 对岗位商品保存三项评估：岗位标准、安全合规、定价合理性。
- finalize approved 后确认商品进入 `delisted/approved`。
- 对不合格商品确认 request changes 或 reject 不会被发布。

### Buyer Storefront

- 商城只展示 `published/approved` 岗位。
- 未授权时能看到购买/授权入口，不能直接执行。
- 下架岗位不再出现在新购买入口。
- 商品详情不泄露岗位包内部密钥、模型 raw request、cloud bearer、本地绝对路径。

### User Center

- 授权后能在使用者中心看到岗位。
- 能发起执行。
- 成功后能看到结果、artifact 摘要、费用、审计读回。
- 失败后能看到安全失败原因，不能看到 provider secret、raw token、本地路径。
- 岗位下架后，历史执行和费用仍可读。

## OpenClaw Capability Routing Handoff

本地端能力路由中心收口前，云端验收准备只做到协议和证据准备，不在本地端工作树未稳定时声明完整跨端通过。

云端必须满足：

- `GET /dijie/gateway/roles/read-model` 每个 role 顶层输出 `catalogRefs`。
- `packageContext.catalogRefs`、`capabilityRequirements` 和 `blockedCapabilities` 作为详情投影保留。
- `callable=false` 或 `blockedCatalogRefs` 非空时，本地端必须失败关闭。
- 上架和重新发布必须要求 Skill/Tool 能力对接信息完整；旧数据只能进入 legacy report，不能自动伪装成新规范已满足。
- 云端不向 OpenClaw 返回工具源码、MCP/adapter 实现、provider key、OAuth token、raw prompt、raw API payload、本地路径或平台业务数据库访问能力。

本地端最终联调需要覆盖：

| Step | Expected result |
| --- | --- |
| OpenClaw 调用 `dijie.marketplace.roles.list` | 能读到云端已授权岗位和 `catalogRefs` |
| 能力路由中心解析岗位 | 本地工具、Skill、远程 API、MCP/provider、人工确认、缺失能力分类正确 |
| 缺配置或未审核能力 | 显示 `needs_config`、`needs_auth`、`needs_review` 或 `blocked`，执行失败关闭 |
| 已满足能力 | 本地端可请求 execution token 并启动岗位执行 |
| 执行完成 | 云端可读 execution、artifact、audit、ledger 摘要 |
| 执行失败 | 云端可读脱敏失败原因，不产生成功 ledger |

本地端当前处于代码收口期时，本轮云端结论只能写“云端协议和验收准备完成，等待 OpenClaw 主流程稳定后跑跨端 E2E”。

### Current Cross-End Readiness Snapshot

2026-06-11 只读检查结果：

- OpenClaw 本地端已经有 `capability-routing-store` 和“能力路由中心”页面雏形。
- 本地端 targeted UI 能力路由测试通过：`52 pass / 0 fail`。
- 本地端 AICS extension targeted tests 通过：`52 pass / 0 fail`。
- 本地端工作树仍在大面积改动中，因此本轮不声明完整跨端 E2E 通过。
- 云端 read model 与本地端当前读取形态一致：本地端优先读取顶层 `catalogRefs`，并兼容 `packageContext.catalogRefs` 和 `capabilityRequirements`。

当前 dev 数据 legacy cleanup 结果：

- 已归档并软删除旧 listing：`djrole_01KTG17DEK2WVM5NSS00198TP2`、`djrole_01KTH4X8QEEZYTKVQ7J75G141C`、`djrole_01KTNAF2592K3XC8FXKG8N56D9`
- 已软删除旧 checkout product 投影：`prod_checkout_djrole_01KTG17DEK2WVM5NSS00198TP2`、`prod_checkout_djrole_01KTH4X8QEEZYTKVQ7J75G141C`
- 已撤销旧 active entitlements：9 条
- 保留历史事实：27 条 audit record、34 条 ledger entry
- 清理后 legacy report：`checked=0`、`issueCount=0`

最终跨端验收不再使用这些旧数据证明新规范。下一轮必须从开发者中心生成一个带完整 Skill/Tool catalogRef 的新岗位重新走。

2026-06-11 重新走准备和阻断记录：

- 已执行 `dijieAuditRecordStore` migration `Migration20260610001000`，补齐 `dijie_catalog_item` 和 `dijie_catalog_review_request` 表；否则岗位生成会在读取能力目录时报 `relation "dijie_catalog_item" does not exist`。
- API dev 当前使用 Codex CLI 模型桥启动：`DIJIE_DIALOG_MODEL_BRIDGE=codex-cli`、`DIJIE_CODEX_SANDBOX=read-only`、`DIJIE_CODEX_TIMEOUT_MS=300000`、`DIJIE_ROLE_PACKAGE_STAGE_TIMEOUT_MS=180000`。
- 已重建 `packages/vendor` 和 `apps/vendor` 静态产物，`/seller` 加载 `index-DQhAV7lF.js`，停止按钮 UI 修复已生效。
- 停止按钮验收通过：进入 `role_package/manifest.json` 生成后点击停止，UI 回到待命、输入框恢复、无 `codex exec` 子进程残留。
- 阶段超时验收通过：智能门锁电商美工岗位第一阶段生成在 180 秒未返回时，API 返回 `504`，页面显示 `manifest: model_bridge_timeout` 和失败阶段 `manifest.json`，无 `codex exec` 子进程残留。
- 当前未生成新的智能门锁 role package 草稿；阻断点是 Codex CLI 第一阶段模型输出超过 180 秒。继续真人验收前需要选择：提高阶段超时、换更快模型桥，或把 `manifest.json` 阶段提示/输出进一步缩小。

## Evidence Sheet

每次真人验收复制一份，填真实 id。

```text
run date:
cloud base url:
api commit:
storefront commit:
admin/vendor commit:

developer account:
admin reviewer account:
buyer/user account:

fixture role title:
draft id:
draft status before submit:
package id:
package version:
catalog review ids:
catalog review final states:
role listing id:
role review id:
role listing state after submit:
role listing state after admin finalize:
role listing state after publish:
entitlement id:
authorization source:
execution id:
execution status:
audit record id:
artifact ids/refs:
ledger entry ids:
delisted readback result:

screenshots:
developer smoke:
admin smoke:
storefront smoke:
user center smoke:

non-blocking issues:
blocking issues:
decision:
```

## Automated Verification Commands

Run these before human UI smoke:

```bash
npm run typecheck:api:prod -- --pretty false

bun test \
  apps/api/src/api/vendor/dijie/role-packages/generate/route.test.ts \
  apps/api/src/api/vendor/dijie/role-packages/drafts/latest/route.test.ts \
  'apps/api/src/api/vendor/dijie/role-packages/drafts/[draftId]/submit/route.test.ts' \
  apps/api/src/api/admin/dijie/catalog-review/route.test.ts \
  'apps/api/src/api/admin/dijie/catalog-review/[reviewId]/finalize/route.test.ts' \
  apps/api/src/api/vendor/dijie/role-listings/route.test.ts \
  'apps/api/src/api/vendor/dijie/role-listings/[roleListingId]/publish/route.test.ts' \
  'apps/api/src/api/vendor/dijie/role-listings/[roleListingId]/delist/route.test.ts' \
  'apps/api/src/api/vendor/dijie/role-listings/[roleListingId]/submit-review/route.test.ts' \
  'apps/api/src/api/admin/dijie/reviews/[reviewId]/finalize/route.test.ts' \
  apps/api/src/lib/dijie/role-capability-integration.test.ts \
  apps/api/src/api/dijie/authorizations/route.test.ts \
  apps/api/src/api/dijie/executions/route.test.ts \
  'apps/api/src/api/dijie/executions/[executionId]/route.test.ts' \
  apps/api/src/api/dijie/audit/route.test.ts \
  apps/api/src/api/dijie/ledger/entries/route.test.ts

bun run --cwd packages/vendor lint
bun run --cwd packages/admin lint
npm run lint
```

Before final cross-end acceptance, run the read-only legacy report:

```bash
npx medusa exec ./src/scripts/dijie-role-capability-legacy-report.ts
```

For storefront:

```bash
npm run lint
npx tsc --noEmit --pretty false
```

## Current Automated Evidence

| Date | Command | Result | Notes |
| --- | --- | --- | --- |
| 2026-06-10 | `npm run typecheck:api:prod -- --pretty false` | PASS | API production TypeScript gate passed |
| 2026-06-10 | focused closed-loop API route suite | PASS | 69 pass / 0 fail across 13 route test files |
| 2026-06-10 | `bun run --cwd packages/vendor lint` | PASS | 0 warnings / 0 errors |
| 2026-06-10 | `bun run --cwd packages/admin lint` | PASS | 0 warnings / 0 errors |
| 2026-06-10 | root `npm run lint` | PASS WITH WARNINGS | Exit 0; 7 existing warnings in registry/templates/core/cli/admin-test/vendor files, not in this closed-loop slice |
| 2026-06-10 | storefront `npm run lint` | PASS WITH WARNINGS | Exit 0; existing Google Font preconnect and React hook dependency warnings |
| 2026-06-10 | storefront `npx tsc --noEmit --pretty false` | PASS | No TypeScript errors |
| 2026-06-11 | `bun test apps/api/src/api/admin/dijie/review-center/route.test.ts apps/api/src/lib/dijie/role-review-center.test.ts` | PASS | 11 pass / 0 fail after admin review-center fallback fix |
| 2026-06-11 | `npm run typecheck:api:prod -- --pretty false` | PASS | API production TypeScript gate still passes after fallback fix |
| 2026-06-11 | `npm exec oxlint -- apps/api/src/api/admin/dijie/review-center/route.ts apps/api/src/lib/dijie/role-review-center.ts --max-warnings 0` | PASS | 0 warnings / 0 errors on changed API files |
| 2026-06-11 | focused role-marketplace API/lib suite | PASS | 115 pass / 0 fail across role package, catalog review, listing review/publish, authorization, checkout, execution, audit, ledger, readback, gateway and Skill/Tool integration tests |
| 2026-06-11 | `npm run typecheck:api:prod -- --pretty false` | PASS | API production TypeScript gate passed after Skill/Tool integration hard gate |
| 2026-06-11 | `bun run --cwd packages/vendor lint` and `bun run --cwd packages/admin lint` | PASS | 0 warnings / 0 errors |
| 2026-06-11 | root `npm run lint` | PASS WITH WARNINGS | Exit 0; 7 existing warnings, not in this closed-loop slice |
| 2026-06-11 | storefront `npm run lint` and `npx tsc --noEmit --pretty false` | PASS WITH WARNINGS | TypeScript passed; lint exit 0 with existing Google Font preconnect and React hook dependency warnings |
| 2026-06-11 | workspace `npm run dev:doctor` | PASS WITH ATTENTION | Correctly identifies one API on 9000 and one storefront on 3036; remaining attention is `ControlCe` occupying 7000 |
| 2026-06-11 | publish/delist/finalize route gate tests and capability integration legacy check | PASS | 13 pass / 0 fail; HTTP 409 is preserved for missing Skill/Tool integration and legacy approved listings can be reported without mutating data |
| 2026-06-11 | `npm run typecheck:api:prod -- --pretty false` | PASS | API production TypeScript gate passed after route-level Skill/Tool gate coverage |
| 2026-06-11 | focused role-marketplace API/lib suite | PASS | 132 pass / 0 fail across role package, catalog review, listing review/publish/delist, authorization, checkout, execution, audit, ledger, readback, gateway and Skill/Tool integration tests |
| 2026-06-11 | `npm exec oxlint -- ... --max-warnings 0` on changed API files | PASS | 0 warnings / 0 errors |
| 2026-06-11 | `bun run --cwd packages/vendor lint` and `bun run --cwd packages/admin lint` | PASS | 0 warnings / 0 errors |
| 2026-06-11 | root `npm run lint` | PASS WITH WARNINGS | Exit 0; 7 existing warnings, not in this closed-loop slice |
| 2026-06-11 | storefront `npm run lint` and `npx tsc --noEmit --pretty false` | PASS WITH WARNINGS | TypeScript passed; lint exit 0 with existing Google Font preconnect and React hook dependency warnings |
| 2026-06-11 | workspace `npm run dev:doctor` | PASS WITH ATTENTION | One API on 9000, one storefront on 3036, one OpenClaw gateway on 18789; remaining attention is `ControlCe` occupying 7000 |
| 2026-06-11 | `npm run typecheck:api:prod -- --pretty false` | PASS | API production TypeScript gate passed after OpenClaw capability routing handoff docs and legacy report script |
| 2026-06-11 | capability routing targeted tests | PASS | 9 pass / 0 fail across capability integration helper, gateway role read model and gateway route tests |
| 2026-06-11 | focused role-marketplace API/lib suite | PASS | 104 pass / 0 fail across the cloud acceptance-prep API/lib subset: listing review/publish/delist, checkout, authorization, execution, audit, ledger, readback, gateway and Skill/Tool integration |
| 2026-06-11 | `npm exec oxlint -- apps/api/src/scripts/dijie-role-capability-legacy-report.ts apps/api/src/lib/dijie/role-capability-integration.ts --max-warnings 0` | PASS | 0 warnings / 0 errors |
| 2026-06-11 | `npm exec medusa -- exec ./src/scripts/dijie-role-capability-legacy-report.ts` | PASS WITH LEGACY ISSUES | Read-only report checked 3 approved public/re-publishable role listings and found 3 missing Skill/Tool catalogRef integration facts |
| 2026-06-11 | `npm exec medusa -- exec ./src/scripts/dijie-role-legacy-cleanup.ts apply` | PASS | Archived/soft-deleted 3 legacy role listings, soft-deleted 2 checkout product projections, revoked 9 active entitlements, preserved 27 audit records and 34 ledger entries |
| 2026-06-11 | `npm exec medusa -- exec ./src/scripts/dijie-role-capability-legacy-report.ts` | PASS | After cleanup: `checked=0`, `issueCount=0` |

## Current UI Smoke Evidence

Run date: 2026-06-11  
Cloud base URL: `http://127.0.0.1:9000`  
Storefront base URL: `http://127.0.0.1:3036`  
API/admin/vendor commit: `b04e7cfb` with local working tree changes  
Storefront commit: `4bf7f54`  
OpenClaw commit: `9e33f68f`

### Process Precheck

- Port `9000`: one API/Medusa dev process.
- Port `3036`: one storefront dev process.
- Port `7000`: occupied by local `ControlCe`; not killed because it is not confirmed garbage.
- Port `18789`: OpenClaw gateway.
- Port `3000`: Mymir MCP local service.
- No duplicate API/storefront dev process was killed in this run.

### Browser Observations

| Surface | Observation | Result |
| --- | --- | --- |
| Storefront | Home page shows two `published/approved` smart-lock role listings and does not expose the delisted listing id `djrole_01KTNAF2592K3XC8FXKG8N56D9`. | PASS |
| Storefront role detail | Paid role `djrole_01KTH4X8QEEZYTKVQ7J75G141C` shows public business description, pricing and usage rules; no provider key, bearer token, raw payload or local path string detected in visible text. | PASS |
| Paid checkout | `POST /dijie/role-checkouts/cart` prepared checkout cart; confirmation page shows digital role authorization and does not show `requires_shipping` or `No shipping method selected` errors. | PASS |
| Developer center | Vendor login succeeded; store-select entered `AICS-293 Smoke Seller 1781076559510`; dashboard read model loaded with developer dialog, zero current listings for that seller, one sales authorization. | PASS |
| Admin review center | Chrome session is logged in as `AICS Admin`; review center renders queue, review records and Skill/Tool/能力 wording without login redirect or secret/path leakage. | PASS |
| Seller center | Chrome session is logged in as `AICS-293 Smoke Seller 1781076559510`; developer dialog asks for business scenario, SOP, Skill, tools, acceptance and failure standards. | PASS |
| User center | Chrome session is logged in; user messages page shows my authorization, execution records, cost records and execution confirmation entry points; no secret/path leakage detected. | PASS |
| Checkout confirmation | Confirmation page shows “岗位授权 / 确认购买岗位授权”, digital authorization copy, and no shipping requirement error. After explicit local-dev confirmation, the second `再次确认授权` step completed checkout and returned to the role detail page with `dijieOrderId`. | PASS |
| Admin review center | Initial UI smoke hit `GET /admin/dijie/review-center` 502. Fixed by making optional catalog/review/package read-model inputs fail closed to empty data instead of failing the whole page. After fix, dashboard renders three role review records. New rule: future approvals and publish require completed Skill/Tool capability integration info. | PASS AFTER FIX |
| User center authorization | Authorized role `djrole_01KTG17DEK2WVM5NSS00198TP2` appears in user center with authorization date, fee and token pricing. | PASS |
| Unauthorized user role | Direct user-center access to not-owned role `djrole_01KTH4X8QEEZYTKVQ7J75G141C` shows `当前账号未授权` and only links back to marketplace; no execute button is available. | PASS |
| Execution/readback | User executed authorized role and saw completed readback with one artifact, audit generated, ledger generated, and fee `¥0.01`. No provider key, raw token, raw response or local path string detected in visible text. | PASS |
| Execution list | User execution records page shows the 2026-06-11 14:13 execution summary with fee `¥0.01`. | PASS |
| Paid checkout entitlement | New paid order `og_01KTTYRTM7N1416J1NTTWGWRVW` materialized entitlement `djent_01KTTYRTYCD83ZNB8MJXKY79NX`; user center shows the ¥399 authorization dated 2026/6/11. | PASS |
| Paid role execution/readback | New paid authorization executed role `djrole_01KTH4X8QEEZYTKVQ7J75G141C` and reached readback page with completed status, one artifact, audit generated, role_usage ledger, input/output token quantities, and fee `¥0.01`. | PASS |

### Evidence IDs

```text
fixture role title: 智能门锁电商美工岗位
published role listing id: djrole_01KTG17DEK2WVM5NSS00198TP2
paid role listing id checked in checkout: djrole_01KTH4X8QEEZYTKVQ7J75G141C
delisted role listing id checked for public invisibility: djrole_01KTNAF2592K3XC8FXKG8N56D9

package id: smart-lock-ecommerce-visual-designer
package version: 1.0.0
role review id: review_djrole_01KTG17DEK2WVM5NSS00198TP2
entitlement id: djent_01KTS0XMP37EKXJ37P5M1EDNAZ
authorization source: checkout
checkout order/group fact: og_01KTS0XMEPVGZHVWKMXPC4QTTP
execution id: a16c843d-43de-4def-a1fe-e95da72d789b
execution status: completed
audit record id: djaudit_01KTTN18ZEJ24T18B7QDE8HRKD
artifact id/ref: artifact_a16c843d-43de-4def-a1fe-e95da72d789b_main_image_plan
ledger entry id: djledger_01KTTN18ZSEQT7YG4TY4SVEDJ1
ledger source/kind: role_usage / model_tokens
ledger amount: 1 CNY cent

fresh paid checkout order/group fact: og_01KTTYRTM7N1416J1NTTWGWRVW
fresh paid entitlement id: djent_01KTTYRTYCD83ZNB8MJXKY79NX
fresh paid authorization ledger id: djledger_01KTTYRTYKTG3KXV2ZWDT9Q927
fresh paid authorization ledger source/kind: role_marketplace / install
fresh paid authorization ledger amount: 39900 CNY cents
fresh paid execution id: 39ca9d71-c384-4504-ab6f-05533eac575a
fresh paid execution status: completed
fresh paid audit record id: djaudit_01KTTYV8Y1KMTWYTSJV7J2P5AJ
fresh paid artifact id/ref: artifact_39ca9d71-c384-4504-ab6f-05533eac575a_main_image_plan
fresh paid execution ledger id: djledger_01KTTYV8YJ0XNPWZME40SMNTA6
fresh paid execution ledger source/kind: role_usage / model_tokens
fresh paid execution ledger amount: 1 CNY cent
```

### Blocking And Non-Blocking Issues

- Fixed blocker: admin review center 502. Root cause was optional catalog/review/package read-model dependency failure being treated as a full-page failure. The page now keeps the role review queue available when those optional projections fail.
- Migration issue: existing already-published legacy role packages may not declare `catalogRef`; they should be backfilled before delist/re-publish. New approvals and new publish attempts now treat missing Skill/Tool capability integration as a blocker.
- Non-blocking issue: developer smoke used an existing seller with no current role listings; it verified dashboard/read model access but did not generate a new package in this UI pass.
- Completed in this run: final paid checkout was clicked after explicit local-dev confirmation; it created a new order/group fact, entitlement, authorization ledger, execution, audit record, artifact and role_usage ledger.

Decision: UI smoke confirms storefront, paid checkout, entitlement materialization, developer center, admin review center, user authorization, execution, audit, ledger and public delist visibility after the admin blocker fix. This run supports continuing with the next closed-loop hardening tasks, but a full fresh developer-generated package -> new review -> new publish browser flow is still a separate final acceptance pass.

## Completion Standard

可以进入记忆盒子设计/实现的最低标准：

- 主成功链路能完整走通。
- 关键失败链路不会越权、乱跳状态或伪成功。
- 历史授权、执行、费用、审计不会因为下架而丢失。
- 证据文档记录真实 id、页面观察、失败链路结果和非阻断问题。
- PR 可以作为岗位市场主闭环基线合并。

如果 API 自动化绿但 UI smoke 未跑，结论只能写“后端闭环可进入真人验收”，不能写“主闭环已验收通过”。
