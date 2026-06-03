# Dijie Frontend Operation Centers

## Product Boundary

OpenClaw local UI is the Dijie AI main system. It owns the main conversation,
local execution, local role installation state, task state, feedback packet
production, and safe cloud readback caches.

Dijie/Mercur cloud UI is the business system. It owns marketplace browsing,
role product publishing, review, authorization, billing, settlement, and audit
records.

The local UI must not render a fake role marketplace. Its role marketplace entry
opens the cloud buyer storefront.

## Cloud Centers

### Buyer Center

Built from the existing buyer storefront pages.

Primary surfaces:

- Role marketplace
- Role detail
- Authorization purchase
- My authorizations
- Orders
- Usage records
- Cost records

The buyer AI operation box runs in user mode. It may navigate, filter, compare,
prepare purchase steps, show authorizations, and read safe usage summaries.
Payment, purchase confirmation, and local execution authorization stop at a
human confirmation point.

### Developer Center

Built from the existing vendor panel pages.

Primary surfaces:

- Role package upload
- Role product creation
- Pricing
- Review status
- Sales records
- Settlement records
- Feedback summaries

The developer AI operation box runs in developer mode. It may turn business
logic into a draft role product, help upload a role package, prepare form
fields, inspect missing review material, and read review status. Publishing,
price changes, review submission, and delisting stop at a human confirmation
point.

### Review Center

Built from the existing admin panel pages.

Primary surfaces:

- Pending role products
- Role package public summary
- Safety scan summary
- Pricing and authorization checks
- Approve or reject

The review UI shows only safe review material. It must not expose raw tokens,
provider credentials, local absolute paths, raw prompts, chat history, or private
execution facts.

## AI Operation Layer

The AI operation box is not seller chat or support chat. It is a page-aware
operation layer.

Each operation box receives safe context:

- Current center
- Current page
- Current user role
- Current object ids
- Available low-risk actions
- Available high-risk confirmation flows

It must not receive or display:

- System prompts
- Raw prompts
- Provider tokens
- Local absolute paths
- Full chat history
- Private execution facts
- Raw role package internals

Low-risk actions may be executed directly by AI. High-risk actions may be
prepared by AI, but the user must perform the final confirmation.

The first shared action vocabulary is:

- `navigate`: move to another safe page.
- `fill_form`: write a local form draft.
- `show_summary`: show a safe page or object summary.
- `sync_status`: refresh or validate page state.
- `prepare_confirmation`: prepare a high-risk action and stop.

Every action carries a risk level. `low` actions may run immediately inside the
page. `high` actions must set a pending-confirmation state and must not click
the final purchase, publish, submit, delete, payment, or local-execution button
for the user.

## Data Authority

Cloud is authoritative for role products, orders, authorizations, pricing,
billing, settlement, review, and audit records.

Local OpenClaw is authoritative for local conversations, local execution state,
installed package state, local task runtime, and feedback packet production.

Shared data uses ids and safe projections. The local system may cache cloud safe
readbacks, but it must not maintain a parallel marketplace, order, billing, or
authorization database.
