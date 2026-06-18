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

Temporary smoke screenshots and the throwaway runner under `/private/tmp` were
cleaned after review. The retained evidence is the observed UI state below plus
the API/execution IDs above.

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

## 2026-06-08 User Center Direct Execution Smoke

Scope added after the user-center/local-end alignment pass:

`authorized role -> user center role detail -> cloud user-center execution -> execution/audit/artifact/ledger readback`

Observed with real Google Chrome on `http://localhost:3025` using the existing logged-in `localhost` customer session.

- My authorizations page loaded `智能门锁电商美工岗位` from `GET /dijie/my-roles`.
- `使用岗位` link opened `/us/user/roles/djrole_01KTG17DEK2WVM5NSS00198TP2`.
- Role detail showed entitlement `djent_01KTGSW0DABC5N11HT7A1KY8MK`, `已授权 / 可使用`, `99.00 CNY`, direct-use task input, cost confirmation, capability list, input requirements, output examples, and failure boundaries.
- Direct cloud execution was triggered with smart-lock main-image task text after cost confirmation.
- New execution: `705351f0-8c9b-4ec4-9c5a-9720ceac4c30`.
- Execution readback page showed `completed`, role `djrole_01KTG17DEK2WVM5NSS00198TP2`, `artifact 1 个`, artifact `智能门锁主图设计方案 / design_plan_text`, audit status `completed`, and ledger `role_usage`.
- Ledger readback showed input tokens `80`, output tokens `555`, developer receivable `0.01 CNY`.
- Execution records page showed the new execution and `查看读回` link back to `/us/user/executions/705351f0-8c9b-4ec4-9c5a-9720ceac4c30`.

Focused verification added in this pass:

- Marketplace `POST /dijie/executions` route tests: cloud success, unentitled rejection, missing input, missing capability.
- Marketplace `POST /dijie/audit` route tests: failed audit upload can persist without fake role_usage ledger.
- Storefront TypeScript check and production build passed.
- OpenClaw `dijie_role_task_run` tests cover local success, `failed/input_required`, and `failed/capability_missing`.

## 2026-06-08 Cleanup Regression

Follow-up cleanup after reviewing the user-center/cloud execution/frontend text:

- Removed user-facing internal contract wording from direct-use and readback pages (`execution/audit/artifact/ledger`, `role_usage`, token wording, and developer-receivable wording).
- Fixed execution-record filtering to use ledger `source === "role_usage"` instead of the incorrect `usageKind === "role_usage"` fallback.
- Made human-checkpoint confirmation a real backend guard for `POST /dijie/executions`, not only a frontend checkbox.
- Google Chrome regression on `http://localhost:3026` confirmed:
  - Role detail page loads the smart-lock role and direct-use panel.
  - `发起使用` remains disabled after only cost confirmation.
  - `发起使用` becomes enabled only after both cost and human-checkpoint confirmations.
  - New execution `bbbe962d-62dc-483d-a1d6-6646e065d577` completed.
  - Readback shows `智能门锁主图设计方案`, `design_plan_text`, `岗位使用`, input/output amounts, and `费用金额`.
  - Execution records page shows the new execution and its `查看读回` link.

## 2026-06-08 Final Chrome Persona Recheck

Follow-up after the audit/readback id display fix and approved-review checklist cleanup.

- Reviewer persona used real Google Chrome on `http://127.0.0.1:9000/dashboard`.
- The admin session was re-authenticated with the AICS-293 admin fixture account after refresh returned to the login page.
- Review center showed `审核中心`, the three tabs `岗位审核 / 审核记录 / 审核设置`, `AI 审核助手`, and the smart-lock role in `已通过 / published`.
- Approved + published listings no longer show automatic checklist misses as blocking failures. Chrome text contained `已通过；复核建议` and did not contain `阻断` or `需处理：使用规范`.
- User persona used real Google Chrome on `http://127.0.0.1:3027`.
- Role detail showed authorization `djent_01KTKCV9X10RQSC3T82JA8BNJW`, authorization fee `399.00 CNY`, input Token fee `¥1.20/百万 Token`, output Token fee `¥3.60/百万 Token`, usage instructions, required capabilities, input requirements, output examples, and failure boundaries.
- The user submitted the smart-lock Chinese-style design task from the role detail page after confirming cost/audit and human checkpoints.
- New execution: `31e790ce-3d3b-4ddf-9aeb-e3dac350b4fe`.
- Readback page showed `completed`, role `djrole_01KTH4X8QEEZYTKVQ7J75G141C`, 1 business artifact `智能门锁主图设计方案 / design_plan_text`, fee `0.01 CNY`, audit id `djaudit_01KTKRRT2S89YDXCQ8NV8VT1WK`, audit status `completed`, and ledger source `岗位使用`.
- Ledger showed input Token price `¥1.20/百万 Token`, output Token price `¥3.60/百万 Token`, input amount `320`, output amount `1560`, and fee amount `0.01 CNY`.
- A previous execution `35ae4d6b-b31e-4dd2-b5c5-6992d14614ae` returned 403 for the current buyer because its audit actor was `cus_01KTJZCNWHV29XBF7C7FT83QKV`, while the logged-in buyer fixture maps to `cus_01KTKCJCV820ENA5TW7Z55C39F`; this confirms actor-scoped readback protection rather than a frontend readback bug.
