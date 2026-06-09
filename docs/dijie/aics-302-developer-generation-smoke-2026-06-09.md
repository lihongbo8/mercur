# AICS-302 Developer Generation Smoke - 2026-06-09

## Summary

Real Chrome smoke passed for the developer-center role-package generation path.

This smoke covers the narrowed AICS-302 scope only: developer natural-language intake, explicit human start confirmation, staged role_package generation, draft preview/edit surface, file confirmation, draft adoption, and saving an AICS role listing as a draft. It does not include admin review, storefront buyer flow, user center execution, checkout, wishlist naming, or OpenClaw main-chat execution.

## Environment

- Chrome page: `http://localhost:7001/seller`
- Seller account: `aics293-vendor-1780900845328@example.test`
- Seller: `AICS-293 Smoke Seller 1780900845328`
- Marketplace API: `http://localhost:9000`
- API was restarted for this smoke with:
  - `DIJIE_OPENCLAW_MODEL_BRIDGE=cli`
  - `DIJIE_OPENCLAW_CLI_PATH=/opt/homebrew/bin/openclaw`
  - `DIJIE_OPENCLAW_MODEL_BRIDGE_EXECUTION=local`
  - `DIJIE_OPENCLAW_MODEL=openai/gpt-5.5`
  - `DIJIE_OPENCLAW_MODEL_TIMEOUT_MS=1800000`
- Local evidence screenshot: `/private/tmp/aics-302-developer-smoke-products-2026-06-09.png`

## Chrome Evidence

1. Developer sent a complete smart-lock ecommerce visual-designer role requirement.
2. The assistant did not start generation automatically.
3. The assistant returned a development plan and required a separate `开始开发` confirmation.
4. Developer sent `开始开发`.
5. The existing seller already had partial draft `djdraft_01KTKYX5E1MSX601B45XZFQABE` with 13 files, so generation continued from 13/16 rather than starting from 0/16.
6. Staged generation progressed through:
   - `14/16` files, status `partial`, quality score `100`, blockers `2`
   - `15/16` files, status `partial`, blockers `1`
   - `16/16` files, status `ready`, blockers `0`
7. Ready draft shown in Chrome:
   - package: `smart_lock_ecommerce_visual_designer`
   - version: `1.0.0`
   - files: `16`
   - quality score: `100`
   - status badge: `可上传`
8. Upload page showed draft preview with all 16 files, a file editor, `保存修改`, and `确认此文件`.
9. Before confirmation, `承接草稿` was disabled.
10. `确认全部` issued confirm requests for all files; API returned 200 for every file confirmation.
11. Upload page then showed `16/16 已确认`, status `可承接`, and enabled `承接草稿`.
12. `承接草稿` succeeded and moved the package area to `已承接` / `已就绪` / `可提交`.
13. Form was manually filled with:
   - authorization fee: `¥99`
   - input token fee: `120` cents / million tokens
   - output token fee: `360` cents / million tokens
   - usage instructions covering required user materials and failure states
14. Saving a draft role listing returned `POST /vendor/dijie/role-listings` 200.
15. Product list after refresh showed:
   - `智能门锁电商美工岗位`
   - `smart_lock_ecommerce_visual_designer@1.0.0`
   - listing status: `草稿`
   - review state: `未提交`
   - authorization fee: `¥99.00`

## Backend Evidence

- Before API restart, generation correctly failed closed with `AI开发助手模型桥暂未配置，不能生成岗位包`.
- `openclaw capability model run --local --json` succeeded under real local permissions, proving the OpenClaw model runtime was usable.
- After restarting API with the `DIJIE_OPENCLAW_*` environment variables, generation requests returned:
  - stage 14: `POST /vendor/dijie/role-packages/generate` 200, about 138s
  - stage 15: `POST /vendor/dijie/role-packages/generate` 200, about 105s
  - stage 16: `POST /vendor/dijie/role-packages/generate` 200, about 129s
- Draft confirmation requests hit:
  - `POST /vendor/dijie/role-packages/drafts/djdraft_01KTKYX5E1MSX601B45XZFQABE/files/confirm` 200 for all 16 files.
- Draft adoption hit:
  - `POST /vendor/dijie/role-packages/drafts/djdraft_01KTKYX5E1MSX601B45XZFQABE/submit` 200.
- Listing draft creation hit:
  - `POST /vendor/dijie/role-listings` 200.

## Observed Issues

- The local API process must be started with `DIJIE_OPENCLAW_MODEL_BRIDGE=cli`; otherwise developer generation correctly fails closed. This is a local runtime configuration item, not a generation flow code failure.
- The same seller had an existing partial draft, so this smoke validated natural-language continuation from 13/16 to ready. A pure 0/16 fresh smoke should use a new seller or add an explicit `start new draft` UI action.
- AICS role listing save is still coupled to ordinary product categories. The smoke selected seed category `Merch` to pass validation, but AICS should get a role-specific category path or bypass normal retail product category validation.
- The product list did not show the new listing immediately after save until the page was refreshed.

## Verdict

AICS-302 developer-generation flow is now proven through real Chrome for the current PR scope:

`developer requirement -> AI plan only -> explicit 开始开发 -> staged generation -> ready role_package -> preview/edit surface -> all-file confirmation -> adopt draft -> save AICS listing draft`

The listing remained `草稿 / 未提交`; no automatic review submission occurred.
