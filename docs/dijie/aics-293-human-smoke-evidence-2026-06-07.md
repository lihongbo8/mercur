# AICS-293 Human Smoke Evidence - 2026-06-07

## Scope

This smoke validates the linked AICS marketplace path:

`admin review approved -> buyer storefront visible/authorized -> user center installed/executable -> OpenClaw local execution -> execution/audit/artifact/ledger readback`

The memory-box work is not part of the AICS-293 blocking path. It is tracked separately as Mymir AICS-303 and summarized in `docs/dijie/aics-memory-box-research.md`.

## Fixture

- Role listing: `djrole_01KTG17DEK2WVM5NSS00198TP2`
- Role title: `智能门锁电商美工岗位`
- Entitlement: `djent_01KTGSW0DABC5N11HT7A1KY8MK`
- Authorization fee: `9900` CNY cents
- Execution: `e9003112-34be-4f1d-a983-d3fb13665c63`
- Audit record: `djaudit_01KTGVAPECPCQ9AMYG060QA03R`

## API And Execution Results

- `GET /admin/dijie/review-center`: 200, admin review queue readable.
- `GET /dijie/roles`: 200, returns only approved + published AICS role listing.
- `POST /dijie/authorizations` without checkout facts: 402 `checkout_required`.
- `GET /dijie/my-roles`: 200, buyer sees only the authorized smart-lock visual designer role.
- `GET /dijie/gateway/roles/read-model`: 200, OpenClaw sees the role as callable.
- `dijie_role_task_run`: completed and produced `design_plan_text / 电商设计方案文本`.
- `POST /dijie/audit`: 200, creates audit readback and formal `role_usage` ledger entry.
- `GET /dijie/executions/:executionId`: 200 for buyer, rejects vendor and anonymous reads.
- Structured readback includes `execution`, `audit`, `artifacts`, `ledger`, and `failureReason`.

## Chrome UI Smoke

Script: `/private/tmp/aics293-ui-smoke.mjs`

Screenshots:

- `/private/tmp/aics293-ui-smoke/aics293-admin-review.png`
- `/private/tmp/aics293-ui-smoke/aics293-storefront.png`
- `/private/tmp/aics293-ui-smoke/aics293-storefront-categories.png`
- `/private/tmp/aics293-ui-smoke/aics293-user-roles.png`
- `/private/tmp/aics293-ui-smoke/aics293-user-ledger.png`
- `/private/tmp/aics293-ui-smoke/aics293-user-messages.png`

Observed UI facts:

- Admin review page shows `审核中心`, `AI 审核助手`, `智能门锁电商美工岗位`, `已通过`, and `¥99.00`.
- Storefront categories page shows `已审核岗位`, the smart-lock role, capability tags, and `99.00 CNY`.
- User roles page shows `我的岗位授权`, the entitlement id, and `99.00 CNY`.
- User ledger page shows `role_usage · model_tokens`, execution `e9003112-34be-4f1d-a983-d3fb13665c63`, `0.01 CNY`, and `openclaw_local`.
- User messages page shows `执行记录`, `授权调用 1`, `费用关联 1`, the same execution id, and `0.01 CNY`.
- All UI smoke assertions passed and browser console error count was 0.

## Verification

- Marketplace focused suite: 51 tests passed.
- OpenClaw role task runner test: 3 tests passed.
- B2C `npm run lint`: passed with existing warnings only.
- Playwright Chrome smoke: all assertions true.
- `git diff --check`: passed in Marketplace, OpenClaw, and B2C storefront.

## Review Notes

- AICS-302 is in review with this Marketplace PR as the primary PR.
- Companion PRs:
  - OpenClaw: `https://github.com/lihongbo8/openclaw/pull/1`
  - B2C storefront: `https://github.com/lihongbo8/b2c-marketplace-storefront/pull/1`
- AICS-293 remains in progress until HOTL decides whether the separate developer-mode package-generation criterion is accepted from prior evidence or needs one more focused smoke.
