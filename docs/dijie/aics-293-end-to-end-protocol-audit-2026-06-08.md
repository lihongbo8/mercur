# AICS-293 End-to-End Protocol Audit

Date: 2026-06-08

Scope: developer center -> admin review -> buyer storefront -> user center -> OpenClaw/local execution -> execution readback.

Memory box remains a separate follow-up task and is not part of this main path.

## Closure Status

AICS-293 is ready to treat as main-path passed for the current PR bundle:

- Developer center, admin review, buyer storefront, user center, OpenClaw sync/tool execution, and execution readback are implemented against the current protocol.
- Real Google Chrome persona checks passed for reviewer, buyer/storefront, user center direct execution, OpenClaw local sync, and OpenClaw AICS role listing/use entry.
- Execution readback shows business artifact, audit id, ledger, token pricing, and actor-scoped access control.
- AICS-302 is no longer the umbrella smoke for this PR bundle. It is narrowed to the developer-center role-package generation smoke and should not absorb admin/storefront/user/OpenClaw evidence.

Follow-up items that should not block this AICS-293 PR bundle:

- Storefront paid checkout mapping: role listing -> cart/order -> orderId-return authorization.
- User center route naming: wrap or rename `/user/wishlist` to a first-class roles/entitlements route.
- OpenClaw main chat model/provider configuration: the AICS protocol works, but the local main-chat run still depends on a clean provider config.
- Memory box: track separately as a later local/cloud memory service task.

## Current Main Contract

| Stage | Frontend entry | Backend protocol | State / data contract | Current result |
| --- | --- | --- | --- | --- |
| Developer package upload | Vendor `/products/create` | `POST /vendor/dijie/role-packages` | Store and validate role package only; do not create listing | Fixed: upload fills package fields and waits for manual product confirmation |
| AI package draft | Vendor developer assistant and upload page | `POST /vendor/dijie/role-packages/generate`, `GET /drafts/latest`, `POST /drafts/:draftId/submit` | Draft becomes formal package only after user confirmation | Fixed: using latest draft creates a formal package only, then waits for manual review submit |
| Listing draft | Vendor product form | `POST /vendor/dijie/role-listings` | `listing_status=draft`, `review_state=draft`, seller scoped refs | Backend matches |
| Submit review | Vendor product form | `POST /vendor/dijie/role-listings/:id/submit-review` | `listing_status=proposed`, `review_state=submitted` | Backend matches |
| Admin queue | Admin review center | `GET /admin/dijie/review-center` | Submitted listings and records, package summary, checks, evaluations, allowed actions | Backend/frontend match |
| Admin assistant | Admin review center right panel | `POST /admin/dijie/dialog/messages` with `surface=admin_review` | Bound to selected `roleListingId/reviewId`; cannot finalize | Backend/frontend match |
| Admin finalize | Admin review center and detail review section | `POST /admin/dijie/reviews/:reviewId/finalize` | `approved -> published+approved`; `needs_changes -> draft+needs_changes`; `rejected -> archived+rejected` | Backend/frontend match |
| Storefront listing | Storefront home/categories/detail | `GET /dijie/roles`, `GET /dijie/roles/:id` | Only `published + approved` public listings | Backend/frontend match |
| Storefront assistant | Storefront AI panel | `POST /dijie/dialog/messages` with `surface=buyer_storefront` | Login required; can recommend/explain/navigate authorization; cannot execute | Backend/frontend match |
| Authorization | Storefront authorization button | `POST /dijie/authorizations` | Free listings create entitlement; paid listings need checkout/orderId | Free path matches; paid orderId-return authorization is wired; product-to-cart checkout mapping remains a future gap |
| User role list | User center `/user/wishlist` | `GET /dijie/my-roles` | Current actor authorized entitlements only | Protocol matches; path/component naming still carries wishlist legacy |
| User cloud execution | User role detail | `POST /dijie/executions` | Confirm cost + human checkpoints; validate entitlement; write audit/artifact/ledger | Backend/frontend match for personal cloud path |
| User execution readback | User execution detail | `GET /dijie/executions/:executionId` | Returns `execution`, `audit`, `artifacts`, `ledger`, `failureReason` | Backend/frontend match |
| OpenClaw sync | OpenClaw main tool | `GET /dijie/gateway/roles/read-model` | Current actor authorized callable roles and entitlement summary | Main tool matches |
| OpenClaw execution token | OpenClaw main tool / AICS extension | `POST /dijie/execution-token` | Short lived token with role, entitlement, device, workspace, scopes, pricing | Protocol matches, but deployment depends on entitlement verifier config |
| OpenClaw audit upload | OpenClaw main tool / AICS extension | `POST /dijie/audit` | Bearer execution token; persist audit and role_usage ledger | Fixed: completed uploads require model usage and at least one business artifact; failed uploads may record failure without usage ledger |

## Implementation Update - 2026-06-08

- Developer upload is now three explicit actions: upload/scan package, save/create listing draft, submit review. Upload and AI-draft adoption no longer auto-create or auto-submit a listing.
- Developer center exposes authorization fee plus input/output Token usage pricing. Developers keep pricing rights, while the backend enforces platform-cost minimums and a maximum markup multiplier before draft creation or review submission.
- Admin review, storefront, user center, and execution readback all use the same role Token pricing contract: reviewers see platform cost and markup checks; consumers see input/output Token unit prices before authorization and use.
- Existing listing submit now calls `submit-review` instead of only showing a toast.
- Marketplace `/dijie/audit` rejects `completed` executions without business artifacts and still allows failed executions such as `failed/input_required` without fake role_usage settlement.
- OpenClaw AICS extension now turns completed local role runs with empty output into `failed/no_artifact`; completed text output becomes a `role_task_result_text` artifact.
- OpenClaw workboard authorization status now says `待同步` until a real sync result exists, and it normalizes nested Marketplace read-model shapes such as `readModel.roles[].entitlement.id`.
- Storefront paid authorization now recognizes `dijieOrderId/orderId/order_id` query params and uses them to materialize paid entitlements after checkout; it also avoids retrying the same checkout order id in a loop.

## Remaining Follow-Up Findings

1. Storefront paid authorization is not complete.
   - Backend supports `checkout_required` and verifies paid order facts when `orderId` is supplied.
   - Storefront `DijieRoleAuthorizationButton` calls authorization without `orderId`; paid listings show a message but do not enter checkout/order creation.

2. User center cloud execution is allowed and should remain separate from OpenClaw.
   - User role detail can directly execute via `/dijie/executions`.
   - OpenClaw is the company/local execution path and sync target, not the only execution path.

3. Execution-token config can still produce cloud connection failures.
   - `/dijie/execution-token` relies on `DIJIE_ENTITLEMENT_VERIFY_URL`; the repo also has local entitlement verifier logic.
   - If this env is missing/unreachable, OpenClaw token preflight fails before execution.
   - Main OpenClaw tool diagnostics now identify which cloud step failed instead of only saying `fetch failed`.

4. User center naming still contains wishlist legacy.
   - `/user/wishlist` renders "我的岗位授权" and uses `/dijie/my-roles`, but path, test ids, and fallback still reference wishlist.
   - Not a chain blocker, but it should be renamed or wrapped to avoid confusing product/dev QA.

5. Defensive auth hardening remains useful on vendor upload.
   - Vendor base middleware should cover `/vendor/*`.
   - `POST /vendor/dijie/role-packages` should still explicitly fail if `actorId` is missing, because it writes owner-scoped package data.

## Theoretical Test Matrix

| Test | Setup | Action | Expected |
| --- | --- | --- | --- |
| Developer upload does not auto-review | Logged-in seller, valid role package | Upload role package only | Package scan shown; no new submitted listing until explicit form submit |
| Developer submit review | Listing draft exists | Click submit review | Listing becomes `proposed + submitted`; admin queue sees it |
| Admin needs changes | Submitted listing with blocking design checks | Save evaluations and finalize `needs_changes` | Listing becomes `draft + needs_changes`; storefront hides it |
| Admin approved | Submitted listing with three pass evaluations | Finalize `approved` | Listing becomes `published + approved`; storefront shows it |
| Storefront unauth assistant | Logged out customer | Try marketplace AI panel | Textarea disabled, login action shown; backend would return 401 |
| Storefront free authorization | Logged-in customer, zero-fee listing | Click authorize | Entitlement created; user center shows role |
| Storefront paid authorization | Logged-in customer, paid listing without order | Click purchase/authorize | Backend returns checkout_required; frontend must route to checkout in future |
| User direct cloud execution | Authorized role | Confirm cost/human checkpoints and submit task | `/dijie/executions` returns executionId, artifact, audit, ledger |
| User missing input | Authorized design role | Submit empty/invalid input | `failed/input_required`, no ledger success, failureReason visible |
| User image capability missing | Authorized design role | Request direct image generation without cloud image support | `failed/capability_missing`, failureReason visible |
| OpenClaw main preflight | Authorized role synced | Run `dijie_role_task_run` | read-model -> execution-token -> audit -> readback; completed requires artifact |
| OpenClaw extension artifact guard | AICS extension role task | Completed local run with no artifacts | Must be failed/no_artifact or audit upload rejected |

## Next Development Order

1. Done: fix developer upload/draft helpers so they do not auto-create and auto-submit listings.
2. Done: add artifact guard in Marketplace `/dijie/audit` and align AICS extension role-task audit summaries.
3. Done: re-run Chrome persona flow for reviewer, buyer storefront, user center, OpenClaw sync/tool execution, and final readback.
4. Follow-up: implement storefront paid checkout mapping from role listing to cart/order and orderId-return authorization.
5. Follow-up: rename or wrap `/user/wishlist` to a first-class user roles/entitlements route.
6. Follow-up: repair local OpenClaw main-chat model/provider config, then re-run the main-chat path.
7. Follow-up: keep AICS-302 scoped to developer-center role-package generation smoke only.

## Chrome Persona Test Results - 2026-06-08

| Persona / surface | Chrome result | Evidence | Status |
| --- | --- | --- | --- |
| Reviewer / admin review center | Regenerated local AICS-293 smoke fixture, logged into the real Chrome admin page, opened product review detail and `/dashboard` review workbench. The product detail showed package summary, capability checks, safety checks, pricing checks, specialty design checks, token pricing and disabled final actions for an already-approved listing. The workbench showed the three-column structure and all three tabs: 岗位审核 / 审核记录 / 审核设置. | Visible admin account `AICS Admin`; role `djrole_01KTH4X8QEEZYTKVQ7J75G141C`; token pricing `输入 ¥1.20/百万 Token / 输出 ¥3.60/百万 Token`; settings included `admin_review`, final action rules, fee rules and design-role hard requirements. | Passed |
| Admin review AI assistant | Used the real Chrome workbench right-side AI assistant and clicked `查缺失`. The assistant replied against the current selected role/review read model and explicitly stated that AI only assists; final approve/needs_changes/reject remains manual. | Visible response called out missing 使用规范, developer revenue review, design-role usage instructions and failure handling. No browser console errors. | Passed |
| Buyer storefront | Logged-in storefront page showed only approved/published role cards. The storefront assistant answered as `buyer_storefront`, recommended smart-lock design roles, and explicitly said it cannot execute roles or read private execution records. Paid role authorization without an order showed checkout-required copy. | Visible roles included "智能门锁电商美工岗位"; paid role action returned "该岗位需要先完成结算，结算成功后才会生成授权". | Passed for browse/consult; checkout still incomplete |
| User center / direct cloud execution | Opened the real Chrome user role detail page for the smart-lock role. The page showed authorization, usage instructions, input material requirements, output examples, failure boundaries, authorization fee and input/output token prices. After checking both confirmations, `发起使用` created a real execution and navigated to readback. | `executionId=b0341ac1-3781-4ed0-bafb-5d74f1d3cb12`; readback showed `completed`, 1 business artifact `智能门锁主图设计方案`, audit `completed`, ledger `0.01 CNY`, input 80 and output 555. | Passed |
| OpenClaw local / workboard | Real Chrome local tab initially showed `同步异常` because the running OpenClaw Gateway still used an expired smoke token. Updated `~/.openclaw/openclaw.json` and Gateway env from the regenerated fixture with backups, then clicked `同步云端授权` again. Workboard showed `云端授权已同步` and `已授权岗位 1`. | Config backups: `~/.openclaw/openclaw.json.bak-aics293-smoke-2026-06-08T10-38-19-434Z` and `~/.openclaw/service-env/ai.openclaw.gateway.env.bak-aics293-smoke-2026-06-08T10-38-19-434Z`. Chrome visible state: `已授权岗位 1`. | Passed for sync |
| OpenClaw local / my roles | Opened real Chrome `/aics` from the local sidebar. The page showed `已安装 1`, `已授权 1`, `岗位列表 1`, and the `智能门锁电商美工岗位` card with a `使用` button. | Visible role card description mentioned 商品图输入、图片理解、图片生成或设计输出、主图/详情页输出标准 and artifact 回写要求. | Passed |
| OpenClaw formal local tool execution | Ran the actual OpenClaw `dijie_role_task_run` tool with the current smoke cloud base/token. The first run correctly failed with `missing_entitlement`; after materializing entitlement through `POST /dijie/authorizations`, the tool completed read-model -> execution-token -> local artifact -> audit upload -> readback. | `executionId=450a80e3-1c59-4928-811c-1a3b84b905e6`; entitlement `djent_01KTKCV9X10RQSC3T82JA8BNJW`; package context digest `pkgctx_e70cc164`; artifact count 1; audit `completed`; failureReason `null`. | Passed |
| OpenClaw main chat entry | From Chrome `/aics`, clicked `使用`, which opened the main chat with the smart-lock role prompt. Sending the task no longer hit the previous authorization sync failure, but the run hung in the model layer because local OpenClaw logs report missing/invalid OpenAI provider config. The run was stopped manually so the UI was not left executing. | Chrome showed `Run status: In progress`, then `Run status: Interrupted`; logs showed `models.providers.openai.apiKey: Missing env var "OPENAI_API_KEY"` and invalid OpenAI provider fields. | Blocked by local model config, not AICS cloud protocol |

Notes:

- This was a real Google Chrome persona pass over visible pages, not an API-only check.
- The AICS cloud protocol and OpenClaw role tool path are now verified with a real execution and readback.
- The remaining local blocker is the OpenClaw main-chat model/provider configuration, not Marketplace authorization, entitlement, package-context, audit, artifact, or ledger protocol.
