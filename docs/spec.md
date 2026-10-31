# SubscriptIQ v4 — Subscription Management System

## Consolidated, Statement-Aligned Implementation Guide

**Reference problem:** Brightloop Software — Subscription Management System (official hackathon statement)
**Stack:** React + Vite + Tailwind CSS, Python FastAPI, PostgreSQL 16, SQLAlchemy 2.x, Alembic

> **How to read this document.** v4 replaces v3 *and* its correction appendix. There is no appendix to reconcile: every section below is authoritative. Code blocks are reference implementations of the logic that matters (billing, payments, conversion, auth). Adapt names to your models, but do not change the *invariants*. Anything not shown (plain CRUD, UI layout) is left to the implementer.

---

## 0. What changed from v3

**Bugs fixed**

| # | v3 problem | v4 fix |
|---|---|---|
| 1 | `validate_password` used `(...) is not None`, so `False` passed and short passwords were accepted | Returns `bool(...)`; tests for 8 vs 9 characters (§7.1) |
| 2 | `with db.begin()` in conversion/payment crashed (auth dependency already opened a transaction on the same session) | No `db.begin()` in handlers. Pattern is: work → `commit()`; on error → `rollback()` (§6.1) |
| 3 | Variant price added twice (once at quotation, again at billing) | Line `unit_price` is a **final, variant-inclusive snapshot**. Billing never reads live variant prices (§8.2) |
| 4 | Discount model inconsistent (per-line vs separate negative line) | Per-line `discount_amount`; one best discount per invoice; `minimum_purchase` evaluated on the targeted subtotal (§12) |
| 5 | Demo claimed "0 created, 200 skipped" on second click | Second click returns `invoices_created: 0, due_found: 0`; UI says "Nothing due — everything already billed" (§17) |
| 6 | Perf seed used product IDs as plan IDs; 150k invoices never generated | Correct FK order, Core bulk inserts, invoices actually seeded (§19) |
| 7 | Undefined helpers (`next_number`, `decode_token`, `oauth2_scheme`, `current_user.customer_id`, scheduler jobs) | Defined (§6, §7, §16) |
| 8 | passlib/bcrypt version breakage, scheduler double-run, psycopg missing in CI | `bcrypt` used directly; advisory lock; `psycopg[binary]` in requirements; CI fixed (§2, §16, §21) |

**Gaps vs the official problem statement closed**

| Statement says | v4 adds |
|---|---|
| Quotation template "already has the right plan and product lines" | `quotation_templates.plan_id` + `quotation_template_lines`; create-from-template copies lines and sets validity (§9) |
| Subscription has an **expiry date** | `subscriptions.expiry_date`; expiry job; billing stops past expiry (§9, §16) |
| Draft → Quotation → Confirmed → Active → Closed, visible to everyone | Explicit transitions + `subscription_status_history` + status badge (§10) |
| Invoice Draft → Confirmed → Paid; team can **confirm, cancel, send, print** | Billing creates **Draft** invoices; confirm / cancel / send / PDF endpoints; bulk-confirm (§11) |
| Taxes "calculated automatically from rules the admin has set" | `products.default_tax_rule_id`, copied to lines; invalid rule fails loudly (§8.3, §11) |
| Customers manage their own subscriptions | Portal pause / resume / close / renew, gated by plan flags and ownership (§10.3) |
| Payment "method, amount, date and a note" | Included; payments only on Confirmed invoices (§13) |

---

## 1. Strategy

Every team gets the identical statement, so judges decide on **completeness of the 11 scenes, correctness of billing, and polish of one differentiator.**

1. **Parity first.** Every scene in the statement works end to end at a basic level before anything is polished.
2. **One differentiator: the "Billing Day" demo** (seeded due subscriptions → one click → invoices created → second click → nothing created). It proves "nothing billed twice or skipped."
3. **Cheap extra:** overdue aging buckets (1–30 / 31–60 / 60+ days) on the overdue report. The statement says overdue invoices must be "chased."
4. **Do not build** proration, dunning sequences, multi-currency, or usage billing. Razorpay is optional P3 (§22).

### 1.1 Judge Q&A (one-liners)

- *How do you prevent double billing?* Unique index on `(subscription_id, billing_period_start, billing_period_end)` plus a `FOR UPDATE` row lock, and the billing clock advances in the same transaction as the invoice insert. The index is the last line of defence, not the first.
- *What if the job crashes mid-run?* Each subscription is its own transaction. A crash rolls back the invoice *and* the clock advance. Rerunning picks up only what is still due.
- *Two workers at once?* The second blocks on the row lock, re-reads the advanced billing date, and skips.
- *How do customers only see their own data?* Every customer-facing query filters by the customer id derived from the JWT user on the server. Hidden buttons are not security.
- *Under 2 seconds with thousands of records?* Indexed filters, server-side pagination, 50k-subscription / 150k-invoice seed, measured p50/p95 in the README.

---

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite, Tailwind CSS v4, React Router, Axios, Recharts | Tailwind v4: `@tailwindcss/vite` plugin and `@import "tailwindcss";` in `src/index.css` |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2.x (`select()` style) | |
| DB | PostgreSQL 16 | `NUMERIC(12,2)` money; **tests must run on Postgres, never SQLite** |
| Migrations | Alembic | §20 |
| Auth | JWT (PyJWT), **`bcrypt` library directly** | Do not use passlib (breaks with recent bcrypt). Reject passwords > 72 bytes |
| Scheduler | APScheduler + Postgres advisory lock | §16 |
| PDF | ReportLab | From invoice snapshots only |
| Email | SMTP, or console backend in dev | `EMAIL_BACKEND=console` logs reset links and invoice emails; use this for demos |
| Rate limit | slowapi | login / reset / forgot |
| Tests | pytest, httpx | financial flows first |

`requirements.txt` (minimum): `fastapi`, `uvicorn[standard]`, `sqlalchemy>=2.0`, `alembic`, `psycopg[binary]>=3`, `pydantic-settings`, `email-validator`, `bcrypt`, `pyjwt`, `python-dateutil`, `apscheduler`, `reportlab`, `slowapi`, `pytest`, `httpx`.

---

## 3. Architecture

```text
React + Tailwind SPA  --(HTTPS, JWT)-->  FastAPI
                                           |-- Auth/Users   |-- Catalog   |-- Quotes/Subscriptions
                                           |-- Billing      |-- Payments  |-- Reports
                                           v
                                      PostgreSQL  <---  APScheduler (single leader via advisory lock)
                                                         billing 01:00 | expiry 02:00 | reminders 08:00
```

Services hold business logic; routers are thin. `billing_service.py` and `payment_service.py` are the only places that mutate invoice money state.

---

## 4. Roles and Permissions (enforced in the backend on every endpoint)

| Capability | Admin | Staff | Customer |
|---|---|---|---|
| Financial dashboard (revenue, MRR, outstanding amounts) | Yes | No (ops counts only) | No |
| Create staff accounts | **Yes (only role)** | No | No |
| Products, variants, plans, tax rules, discount rules | Yes | Read | Read available plans |
| Quotation templates | Yes | Read / use | No |
| Customers | Yes | Yes | Own profile |
| Quotations (create, send, convert) | Yes | Yes | No |
| Subscriptions | Yes | Yes (all transitions) | Own: pause / resume / close / renew where plan allows |
| Invoices: confirm, cancel, send, print | Yes | Yes | View / download own only |
| Record payments | Yes | Yes | No (view own history) |
| Billing Day simulation | Yes | No | No |
| Audit log | Yes | No | No |

Staff "ops counts" = active subscriptions, draft invoices awaiting confirmation, overdue invoice *count*.

---

## 5. Database Design

Rules: money is `NUMERIC(12,2)`, never float. Business records are archived with `is_active = FALSE`, never deleted. All timestamps are `TIMESTAMPTZ`. All primary keys are UUIDs with a **Python-side default** (`uuid.uuid4`) *and* `gen_random_uuid()` server default. Billing dates (`next_billing_date`, periods, due dates) are `DATE`.

### 5.1 Tables

**`users`**: `id`, `full_name`, `email`, `password_hash`, `role` (`admin|staff|customer`), `is_active`, `created_at`, `updated_at`. Unique on `lower(email)`.

**`customers`**: `id`, `user_id` (FK, unique, nullable for seeded/perf rows), `company_name`, `phone`, `billing_address`, `tax_identifier`, `created_at`. Registration creates the `users` row **and** the `customers` row in one transaction.

**`tax_rules`**: `id`, `name`, `rate_percent` (0–100), `is_active`, `valid_from`, `valid_until`, `description`. Admin-configured. Never hard-code a rate in code (seed data may contain one).

**`products`**: `id`, `name`, `product_type`, `sales_price`, `cost_price`, `notes`, `default_tax_rule_id` (FK, nullable; **new**), `is_active`.

**`product_variants`**: `id`, `product_id`, `variant_name` (e.g. brand "Odoo"), `additional_price` (≥ 0, e.g. 560), `is_active`.

**`plans`**: `id`, `product_id`, `name`, `price`, `billing_cycle` (`daily|weekly|monthly|yearly`), `minimum_quantity` (≥ 1), `available_from`, `available_until`, `allow_pause`, `allow_early_close`, `allow_renewal`, `auto_close_on_end`, `is_active`.

**`quotation_templates`** (**changed**): `id`, `name`, `plan_id` (FK, NOT NULL), `validity_days`, `payment_terms_days`, `description`, `created_by`, `is_active`.

**`quotation_template_lines`** (**new**): `id`, `template_id`, `product_id`, `variant_id` (nullable), `quantity`, `tax_rule_id` (nullable; defaults to the product's).

**`quotations`**: `id`, `quotation_number` (unique), `customer_id`, `template_id` (nullable), `plan_id` (**NOT NULL**, FK `ON DELETE RESTRICT`), `issue_date`, `valid_until`, `status` (`draft|sent|accepted|rejected|expired|converted`), `subtotal`, `tax_total`, `grand_total`, `payment_terms_days`, `created_by`. Discounts are evaluated at billing time, so quotations carry no discount total.

**`quotation_items`**: `id`, `quotation_id`, `product_id`, `variant_id`, `description_snapshot`, `quantity`, `unit_price` (**final, variant-inclusive**), `tax_rule_id`, `line_total`.

**`subscriptions`** (**changed**): `id`, `subscription_number` (unique), `customer_id`, `plan_id`, `quotation_id` (nullable), `status` (`draft|quotation|confirmed|active|paused|closed`), `start_date`, `expiry_date` (**new**, nullable), `current_period_start`, `current_period_end`, `next_billing_date` (the last three are NULL until activation), `payment_terms_days` (default 15), `auto_renew`, `closed_reason`, `created_by`, `created_at`, `updated_at`.
`paused` is an operational state required by the pause feature; it is not in the statement's main flow.

**`subscription_items`**: `id`, `subscription_id`, `product_id`, `variant_id`, `description_snapshot`, `quantity`, `unit_price` (**final snapshot**), `tax_rule_id`.

**`subscription_status_history`** (**new**): `id`, `subscription_id`, `from_status`, `to_status`, `changed_by`, `changed_at`, `note`.

**`discounts`**: `id`, `name`, `discount_type` (`fixed|percentage`), `value`, `minimum_purchase`, `minimum_quantity`, `starts_on` (DATE), `ends_on` (DATE), `usage_limit`, `usage_count`, `scope` (`products|subscription`), `is_active`, `created_by`.
**`discount_products`**: `discount_id`, `product_id`. **`discount_redemptions`**: `id`, `discount_id`, `customer_id`, `subscription_id`, `invoice_id`, `discount_amount`, `redeemed_at`.

**`invoices`**: `id`, `invoice_number` (unique), `customer_id`, `subscription_id`, `billing_period_start`, `billing_period_end` (both inclusive), `issue_date`, `due_date`, `subtotal`, `discount_total`, `tax_total`, `grand_total`, `amount_paid`, `balance_due`, `status` (`draft|confirmed|paid|cancelled`), `sent_at` (**new**), `created_at`. **Overdue is derived, never stored.**

**`invoice_items`**: `id`, `invoice_id`, `product_id`, `description_snapshot`, `quantity`, `unit_price`, `discount_amount`, `tax_rate_percent`, `tax_amount`, `line_total`. Snapshots keep history immutable when the catalogue changes.

**`payments`**: `id`, `invoice_id`, `idempotency_key` (unique, nullable), `payment_reference` (partial unique where not null), `method` (`cash|upi|card|bank_transfer|gateway|other`), `amount`, `payment_date`, `note`, `recorded_by`, `created_at`. One row per payment, so partial payments are natural.

**Supporting:** `password_reset_tokens` (`user_id`, `token_hash`, `expires_at`, `used_at`), `notifications` (`kind`, `invoice_id`, `sent_at`, unique on `(invoice_id, kind)` for automated reminders), `audit_logs` (`actor_id`, `action`, `entity_type`, `entity_id`, `meta` JSONB, `created_at`), `sequences` (`name` PK, `value` BIGINT).

### 5.2 Indexes and constraints (non-negotiable)

```sql
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));
CREATE UNIQUE INDEX ux_invoice_period ON invoices (subscription_id, billing_period_start, billing_period_end);
CREATE UNIQUE INDEX ux_subscriptions_quotation ON subscriptions (quotation_id) WHERE quotation_id IS NOT NULL;
CREATE UNIQUE INDEX ux_payments_idempotency ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX ux_payments_reference ON payments (payment_reference) WHERE payment_reference IS NOT NULL;

CREATE INDEX ix_subscriptions_due ON subscriptions (next_billing_date) WHERE status = 'active';
CREATE INDEX ix_subscriptions_customer_status ON subscriptions (customer_id, status);
CREATE INDEX ix_invoices_customer_status_due ON invoices (customer_id, status, due_date);
CREATE INDEX ix_invoices_overdue ON invoices (due_date) WHERE status = 'confirmed' AND balance_due > 0;
CREATE INDEX ix_invoices_issue_date ON invoices (issue_date);
CREATE INDEX ix_payments_invoice ON payments (invoice_id, payment_date);
CREATE INDEX ix_payments_date ON payments (payment_date);
```

CHECK constraints: prices ≥ 0; quantities > 0; `rate_percent BETWEEN 0 AND 100`; `billing_period_end >= billing_period_start`; `amount_paid >= 0 AND balance_due >= 0 AND amount_paid + balance_due = grand_total` on invoices.

---

## 6. Cross-Cutting Conventions

### 6.1 Transaction pattern (use everywhere money or state changes)

The auth dependency loads the user on the **same** request session, so a transaction is already open by the time your handler runs. **Never call `db.begin()` in a handler.** Use:

```python
try:
    ...                      # read with FOR UPDATE where needed, mutate
    db.commit()
except IntegrityError:
    db.rollback()
    ...                      # translate to a friendly AppError or return the winner
except Exception:
    db.rollback()
    raise
```

`get_db` yields a `SessionLocal()` and closes it in `finally`, which rolls back anything uncommitted (so raising `AppError` mid-handler is safe).

When re-reading a row you may already have in the identity map (after waiting on a lock), use `.execution_options(populate_existing=True)` so you see the other worker's committed values.

### 6.2 Money and rounding

```python
# app/core/money.py
from decimal import Decimal, ROUND_HALF_UP
TWO = Decimal("0.01")
ZERO = Decimal("0.00")
def money(x) -> Decimal:
    return Decimal(x).quantize(TWO, rounding=ROUND_HALF_UP)
```

Round **each persisted line amount** (discount, tax, total) with `money()`. Header totals are the **sum of the persisted lines**, never recomputed independently. Discounts apply **before** tax.

### 6.3 Clock and timezone

```python
# app/core/clock.py
from datetime import date, datetime
from zoneinfo import ZoneInfo
IST = ZoneInfo("Asia/Kolkata")
def today_ist() -> date:
    return datetime.now(IST).date()
```

Use `today_ist()` everywhere instead of `date.today()`. Billing comparisons are `DATE` only. Also set `TZ=Asia/Kolkata` in the environment.

### 6.4 Error envelope (one format for everything)

```python
# app/core/errors.py
class AppError(Exception):
    def __init__(self, code: str, message: str, http_status: int = 400, details: dict | None = None):
        self.code, self.message, self.http_status, self.details = code, message, http_status, details or {}

def envelope(code, message, details=None):
    return {"error": {"code": code, "message": message, "details": details or {}}}
```

In `main.py` register handlers so **`AppError`, `RequestValidationError` and `HTTPException` all return this envelope** (the frontend interceptor reads `response.data.error`). Use `AppError` for 401/403/404 as well, never bare `HTTPException`.

### 6.5 Numbering

```python
# app/services/numbering.py
import sqlalchemy as sa
from app.core.clock import today_ist

def next_number(db, prefix: str) -> str:
    year = today_ist().year
    key = f"{prefix}-{year}"
    value = db.execute(sa.text(
        "INSERT INTO sequences(name, value) VALUES (:k, 1) "
        "ON CONFLICT (name) DO UPDATE SET value = sequences.value + 1 RETURNING value"
    ), {"k": key}).scalar_one()
    return f"{key}-{value:06d}"       # INV-2026-000123
```

Atomic under concurrency. It runs inside the caller's transaction, so a rollback may leave a gap. That is acceptable. It also serialises concurrent billing workers on one sequence row, which is fine for a single billing job.

### 6.5.1 Audit

`audit(db, user, action, entity_type, entity_id, meta)` adds an `audit_logs` row **in the same transaction** as the change. Call it on: user/staff creation, discount create/update, invoice confirm/cancel/send, payment recorded, subscription transitions.

---

## 7. Authentication and Security

### 7.1 Password rules (backend is the source of truth)

Statement: more than eight characters, with an uppercase letter, a lowercase letter and a special character.

```python
# app/core/security.py
import re, bcrypt, jwt
from datetime import datetime, timedelta, timezone
from app.core.config import settings
from app.core.errors import AppError

def validate_password(pw: str) -> bool:
    return bool(
        len(pw) > 8
        and len(pw.encode()) <= 72
        and re.search(r"[A-Z]", pw)
        and re.search(r"[a-z]", pw)
        and re.search(r"[^A-Za-z0-9]", pw)
    )

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_access_token(user_id: str, role: str, minutes: int = 30) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({"sub": user_id, "role": role, "exp": exp}, settings.JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise AppError("INVALID_TOKEN", "Invalid or expired token", 401)
```

Required tests: `"Abcdef#1"` (8 chars) **fails**; `"Abcdef#12"` (9 chars) passes; missing upper / lower / special each fail.

Registration: lowercase and trim the email, return a friendly 409 on duplicate, and **public registration always creates `role=customer`** plus the `customers` row. Staff are created only via an admin-only endpoint.

### 7.2 Dependencies

```python
# app/core/permissions.py
from fastapi import Depends
from fastapi.security import HTTPBearer
from sqlalchemy import select

bearer = HTTPBearer(auto_error=False)

def get_current_user(creds=Depends(bearer), db=Depends(get_db)) -> User:
    if creds is None:
        raise AppError("UNAUTHENTICATED", "Login required", 401)
    payload = decode_token(creds.credentials)
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise AppError("INVALID_TOKEN", "Invalid credentials", 401)
    return user

def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise AppError("FORBIDDEN", "Insufficient permissions", 403)
        return user
    return checker

admin_only = require_roles("admin")
staff_plus = require_roles("admin", "staff")
customer_only = require_roles("customer")

def current_customer(db, user: User) -> Customer:
    c = db.execute(select(Customer).where(Customer.user_id == user.id)).scalar_one_or_none()
    if c is None:
        raise AppError("CUSTOMER_PROFILE_NOT_FOUND", "Customer profile not found", 403)
    return c
```

**Ownership rule:** every customer-facing query adds `.where(X.customer_id == current_customer(db, user).id)`. A resource that is not yours returns **404**, not 403, so IDs can't be enumerated.

### 7.3 Token storage

Short-lived access token (30 min). The frontend keeps it in memory with `localStorage` as a hackathon fallback. State the reason in the README and name HttpOnly + SameSite cookies as the production path.

### 7.4 Password reset

1. `POST /auth/forgot-password` returns the same generic response whether or not the email exists.
2. `secrets.token_urlsafe(32)`; store only `sha256(token)` and `expires_at` (15 min).
3. Email link: `{FRONTEND_URL}/reset-password?token=...` (the console backend prints it in dev).
4. `POST /auth/reset-password`: validate hash, expiry and `used_at IS NULL`, apply the §7.1 rules, set `used_at`.

### 7.5 Rate limiting and CORS

slowapi: `5/minute` on login, forgot-password and reset-password; `200/minute` default. CORS restricted to `FRONTEND_URL` (use `allow_origin_regex` for localhost port changes on demo day).

---

## 8. Catalog and Pricing

### 8.1 Rules from the statement

- Product: name, type, sales price, cost price, notes. Variants add a fixed amount (Odoo +560).
- Plan: price, cycle (daily / weekly / monthly / yearly), minimum quantity, availability dates, and the per-plan flags `auto_close_on_end`, `allow_early_close`, `allow_pause`, `allow_renewal`.
- A plan can only be used on a quotation or subscription when `is_active` and `available_from <= today <= available_until` (null bounds mean open).

### 8.2 Single pricing rule (applies once, at quotation or subscription-line creation)

```python
# app/services/pricing.py
def line_unit_price(plan, product, variant) -> Decimal:
    base = plan.price if product.id == plan.product_id else product.sales_price
    return money(base + (variant.additional_price if variant else ZERO))
```

The result is stored in `quotation_items.unit_price`, copied verbatim to `subscription_items.unit_price`, then to `invoice_items.unit_price`. **Billing never adds a variant price again and never reads current catalogue prices.** Staff may override `unit_price` on a draft quotation. Enforce `quantity >= plan.minimum_quantity` on lines for the plan's own product.

### 8.3 Tax defaults

`products.default_tax_rule_id` is copied to template lines, quotation lines and subscription lines (`tax_rule_id`) and can be overridden. `tax_rule_id IS NULL` means untaxed. At billing time the rule's current rate is read and **snapshotted** into `invoice_items.tax_rate_percent`. If a line references a rule that is inactive or outside its validity window, billing for that subscription **fails loudly** (§11) instead of silently charging 0%.

---

## 9. Quotation Templates, Quotations, Conversion

### 9.1 Template → quotation

`POST /quotations/from-template {template_id, customer_id}` (staff+):

- `plan_id = template.plan_id`; validate the plan is available.
- `issue_date = today_ist()`; `valid_until = issue_date + validity_days`; `payment_terms_days` from the template.
- For each template line: create a `quotation_items` row with `line_unit_price(...)`, the variant-aware `description_snapshot`, and `tax_rule_id = line.tax_rule_id or product.default_tax_rule_id`.
- Totals: `subtotal` = sum of line subtotals; `tax_total` = sum of per-line `money(line_subtotal * rate / 100)`; `grand_total = subtotal + tax_total`.

Statuses: `draft → sent → accepted → converted`, plus `rejected`. `sent → expired` when `valid_until` passes; a daily job or on-read check is acceptable.

### 9.2 Conversion (one-time, concurrency-safe)

```python
@router.post("/quotations/{quotation_id}/convert")
def convert_quotation(quotation_id: UUID, body: ConvertBody, db: Session = Depends(get_db),
                      user: User = Depends(staff_plus)):
    q = db.execute(select(Quotation).where(Quotation.id == quotation_id)
                   .with_for_update().execution_options(populate_existing=True)).scalar_one_or_none()
    if q is None:
        raise AppError("QUOTATION_NOT_FOUND", "Quotation not found", 404)
    if q.status != "accepted":
        raise AppError("QUOTATION_NOT_ACCEPTED", "Only accepted quotations can be converted", 409)
    if q.valid_until and q.valid_until < today_ist():
        raise AppError("QUOTATION_EXPIRED", "Quotation validity has ended", 409)
    plan = q.plan
    assert_plan_available(plan, today_ist())          # raises AppError PLAN_UNAVAILABLE
    if db.execute(select(Subscription.id).where(Subscription.quotation_id == q.id)).first():
        raise AppError("QUOTATION_ALREADY_CONVERTED", "Already converted", 409)

    start = body.start_date or today_ist()
    expiry = body.expiry_date or plan.available_until
    if plan.auto_close_on_end and expiry is None:
        raise AppError("EXPIRY_REQUIRED", "This plan auto-closes, so an expiry date is required", 422)

    sub = Subscription(
        subscription_number=next_number(db, "SUB"),
        customer_id=q.customer_id, plan_id=q.plan_id, quotation_id=q.id,
        status="confirmed",                      # customer already accepted the quote
        start_date=start, expiry_date=expiry,
        payment_terms_days=q.payment_terms_days, created_by=user.id,
    )
    for it in q.items:
        sub.items.append(SubscriptionItem(
            product_id=it.product_id, variant_id=it.variant_id,
            description_snapshot=it.description_snapshot, quantity=it.quantity,
            unit_price=it.unit_price, tax_rule_id=it.tax_rule_id))
    sub.history.append(SubscriptionStatusHistory(from_status=None, to_status="confirmed",
                       changed_by=user.id, note=f"Converted from {q.quotation_number}"))
    q.status = "converted"
    db.add(sub)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()                            # ux_subscriptions_quotation fired
        raise AppError("QUOTATION_ALREADY_CONVERTED", "Converted by another request", 409)
    db.refresh(sub)
    return sub
```

The subscription is **not billed yet**. It starts billing when it is activated (§10.2).

---

## 10. Subscription Lifecycle

### 10.1 State machine

```text
Draft -> Quotation -> Confirmed -> Active -> Closed
                                     |  ^
                                     v  |   (only if plan.allow_pause)
                                   Paused
Active/Paused -> Closed  (early close only if plan.allow_early_close; system close at expiry bypasses the flag)
```

Two ways in: created manually by staff (starts `draft`), or converted from an accepted quotation (starts `confirmed`, because the customer already accepted). Each step is an explicit button, and every change writes a `subscription_status_history` row. Show the status as a badge on the list and a timeline on the detail page.

```python
# app/services/subscription_service.py
TRANSITIONS = {
    "draft": {"quotation"},
    "quotation": {"confirmed", "draft"},
    "confirmed": {"active"},
    "active": {"paused", "closed"},
    "paused": {"active", "closed"},
    "closed": set(),                              # closed can never resume
}

def transition(db, sub, to_status, user, note=None, system=False):
    if to_status not in TRANSITIONS[sub.status]:
        raise AppError("ILLEGAL_TRANSITION", f"{sub.status} -> {to_status} not allowed", 409)
    plan = sub.plan
    if to_status == "paused" and not plan.allow_pause:
        raise AppError("PAUSE_NOT_ALLOWED", "Plan does not allow pausing", 409)
    if to_status == "active" and sub.status == "paused" and sub.expiry_date and sub.expiry_date < today_ist():
        raise AppError("SUBSCRIPTION_EXPIRED", "Expired subscriptions cannot resume", 409)
    if to_status == "closed" and not system and sub.status in ("active", "paused") and not plan.allow_early_close:
        raise AppError("EARLY_CLOSE_NOT_ALLOWED", "Plan does not allow early close", 409)
    sub.history.append(SubscriptionStatusHistory(from_status=sub.status, to_status=to_status,
                       changed_by=user.id if user else None, note=note))
    sub.status = to_status
```

### 10.2 Activation (starts the billing clock)

`confirmed → active`: require at least one item; set `current_period_start = start_date`, `current_period_end = cycle_end(start_date, cycle)`, `next_billing_date = start_date`. This bills the first period on or after the start date. If you prefer a later first bill, change *this* line and the billing tests together. Resume from `paused` keeps the existing dates.

### 10.3 Renewal and customer self-service

- **Renew** (only if `plan.allow_renewal`, status `active`): `expiry_date = add_cycle(expiry_date, plan.billing_cycle)`. A closed subscription cannot be renewed; create a new one.
- **Customer portal endpoints** (`customer_only`, ownership enforced): `POST /portal/subscriptions/{id}/pause | resume | close | renew`. They call the same `transition()` functions, so plan flags are enforced identically for staff and customers.
- The statement's "add-ons customers switch on and off" are covered by the pause/close controls above and by add-on products as separate subscriptions. Do not build line-level toggles.

---

## 11. Billing Engine (the core)

### 11.1 Cycle arithmetic

```python
from dateutil.relativedelta import relativedelta

def add_cycle(d: date, cycle: str) -> date:
    return d + {
        "daily": relativedelta(days=1), "weekly": relativedelta(weeks=1),
        "monthly": relativedelta(months=1),   # Jan 31 -> Feb 28/29 (clamped)
        "yearly": relativedelta(years=1),     # Feb 29 -> Feb 28
    }[cycle]

def cycle_end(start: date, cycle: str) -> date:
    return add_cycle(start, cycle) - relativedelta(days=1)    # inclusive last day
```

**Period convention:** `billing_period_start` and `billing_period_end` are both inclusive. Invoice issue is in advance: when `next_billing_date <= today`, the period beginning at `current_period_start` is billed. The period is always computed from `current_period_start`, never from today's date.

### 11.2 Invoice generation (one subscription, one transaction)

```python
# app/services/billing_service.py
@dataclass
class BillLine:
    product_id: UUID; description: str; quantity: int; unit_price: Decimal; tax_rule: TaxRule | None
    subtotal: Decimal = ZERO; discount: Decimal = ZERO
    tax_rate: Decimal = ZERO; tax_amount: Decimal = ZERO; total: Decimal = ZERO

def resolve_tax_rate(rule, on: date) -> Decimal:
    if rule is None:
        return ZERO
    ok = (rule.is_active and (rule.valid_from is None or rule.valid_from <= on)
          and (rule.valid_until is None or rule.valid_until >= on))
    if not ok:
        raise AppError("TAX_RULE_INVALID", f"Tax rule '{rule.name}' not valid on {on}", 409)
    return rule.rate_percent

def generate_invoice_for_subscription(db, subscription_id, today=None) -> Invoice | None:
    """Returns the new Draft invoice, or None if nothing to do (not due / already billed)."""
    today = today or today_ist()
    sub = db.execute(select(Subscription).where(Subscription.id == subscription_id)
                     .with_for_update().execution_options(populate_existing=True)).scalar_one_or_none()
    if (sub is None or sub.status != "active"
            or sub.next_billing_date is None or sub.next_billing_date > today):
        db.rollback(); return None                                  # releases the lock
    plan = sub.plan
    period_start = sub.current_period_start
    if sub.expiry_date and period_start > sub.expiry_date:
        db.rollback(); return None                                  # past expiry: expiry job closes it
    if not sub.items:
        db.rollback(); raise AppError("SUBSCRIPTION_HAS_NO_LINES", "No lines to bill", 409)

    period_end = cycle_end(period_start, plan.billing_cycle)
    next_start = add_cycle(period_start, plan.billing_cycle)

    lines = []
    for it in sub.items:
        ln = BillLine(it.product_id, it.description_snapshot, it.quantity, it.unit_price, it.tax_rule)
        ln.subtotal = money(ln.unit_price * ln.quantity)           # unit_price is already variant-inclusive
        lines.append(ln)

    chosen = pick_best_discount(db, sub, lines, today)             # locks discount rows FOR UPDATE
    if chosen:
        allocate_discount(chosen.amount, chosen.target_lines)

    for ln in lines:
        ln.tax_rate = resolve_tax_rate(ln.tax_rule, today)
        taxable = ln.subtotal - ln.discount
        ln.tax_amount = money(taxable * ln.tax_rate / 100)
        ln.total = taxable + ln.tax_amount

    subtotal = sum((l.subtotal for l in lines), ZERO)
    discount_total = sum((l.discount for l in lines), ZERO)
    tax_total = sum((l.tax_amount for l in lines), ZERO)
    grand = subtotal - discount_total + tax_total               # equals sum of line totals

    invoice = Invoice(
        invoice_number=next_number(db, "INV"), customer_id=sub.customer_id, subscription_id=sub.id,
        billing_period_start=period_start, billing_period_end=period_end,
        issue_date=today, due_date=today + timedelta(days=sub.payment_terms_days),
        subtotal=subtotal, discount_total=discount_total, tax_total=tax_total, grand_total=grand,
        amount_paid=ZERO, balance_due=grand, status="draft")
    for l in lines:
        invoice.items.append(InvoiceItem(
            product_id=l.product_id, description_snapshot=l.description, quantity=l.quantity,
            unit_price=l.unit_price, discount_amount=l.discount, tax_rate_percent=l.tax_rate,
            tax_amount=l.tax_amount, line_total=l.total))
    try:
        db.add(invoice)
        db.flush()                                              # ux_invoice_period fires here if raced
        if chosen:
            chosen.discount.usage_count += 1
            db.add(DiscountRedemption(discount_id=chosen.discount.id, customer_id=sub.customer_id,
                   subscription_id=sub.id, invoice_id=invoice.id, discount_amount=chosen.amount))
        sub.current_period_start = next_start                   # advance the clock in the SAME transaction
        sub.current_period_end = cycle_end(next_start, plan.billing_cycle)
        sub.next_billing_date = next_start
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if "ux_invoice_period" in str(e.orig):
            return None                                         # another worker already billed this period
        raise                                                   # any other integrity error is a real bug
    return invoice
```

Why this is correct:

- The `FOR UPDATE` lock plus `populate_existing` means a second worker waits, then sees the advanced `next_billing_date` and returns `None`.
- A crash before `commit()` rolls back **both** the invoice and the clock advance. A rerun starts from the unchanged row.
- If the unique index ever fires, the loser rolls back and skips. Duplicates are impossible.
- Never commit between taking the lock and the final commit. Never reuse the session after an `IntegrityError` without `rollback()`.

**Missed periods:** one invoice per subscription per job run. If a subscription is several cycles behind, the next run bills the next period. Seed demo data exactly **one** cycle behind (§17).

**Cancelled invoices:** a cancelled invoice still occupies its billing period, so the period is not rebilled automatically. Staff handle corrections manually. This is a documented business rule.

### 11.3 Batch job

```python
# app/jobs/billing_jobs.py
def run_due_billing_job(limit: int | None = None, today=None) -> dict:
    today = today or today_ist()
    created, skipped, failures = 0, 0, []
    with SessionLocal() as db:
        q = (select(Subscription.id)
             .where(Subscription.status == "active", Subscription.next_billing_date <= today)
             .order_by(Subscription.next_billing_date, Subscription.id))
        if limit:
            q = q.limit(limit)
        ids = db.execute(q).scalars().all()
        for sub_id in ids:
            try:
                inv = generate_invoice_for_subscription(db, sub_id, today)
            except AppError as e:
                db.rollback()
                failures.append({"subscription_id": str(sub_id), "code": e.code})
                continue
            except Exception:
                db.rollback()
                logger.exception("billing failed for %s", sub_id)
                failures.append({"subscription_id": str(sub_id), "code": "UNEXPECTED"})
                continue
            created += 1 if inv else 0
            skipped += 0 if inv else 1
    return {"due_found": len(ids), "invoices_created": created, "skipped": skipped,
            "failed": len(failures), "failures": failures[:20]}
```

Billing creates **Draft** invoices only. Nothing is emailed automatically; emailing is the explicit **Send** action (§12).

---

## 12. Invoice Lifecycle (confirm, cancel, send, print)

```text
Draft -> Confirmed -> Paid
  |          |
  v          v
Cancelled  Cancelled (only while amount_paid = 0)

Overdue = DERIVED: status = 'confirmed' AND balance_due > 0 AND due_date < today
```

Every action locks the invoice row (`FOR UPDATE`), checks the state, mutates, writes an audit row, and commits.

| Endpoint | Rule |
|---|---|
| `POST /invoices/{id}/confirm` | `draft → confirmed` (staff+) |
| `POST /invoices/bulk-confirm {ids \| all_drafts, limit}` | Confirms many Draft invoices; returns a count. Used at the end of Billing Day |
| `POST /invoices/{id}/cancel` | `draft` or `confirmed` with `amount_paid = 0` → `cancelled`; otherwise 409 |
| `POST /invoices/{id}/send` | Requires `confirmed` or `paid`; generates the PDF, emails the customer, sets `sent_at` |
| `GET /invoices/{id}/pdf` | Print/download; built from invoice snapshots only |

PDF content: business header, invoice number and dates, customer billing block, line table (qty, unit price, discount, tax %, line total), totals, amount paid, balance due, payment terms.

Customer portal: `GET /portal/invoices` and `/portal/invoices/{id}` return only their own invoices, never Drafts.

---

## 13. Discount Engine

Eligibility, all inside the invoice-creation transaction:

1. `is_active` and `starts_on <= today <= ends_on` (null bounds are open).
2. Target lines: `scope = 'subscription'` → all lines; `scope = 'products'` → lines whose product is in `discount_products`.
3. On the **target** lines: `sum(subtotal) >= minimum_purchase` (if set) and `sum(quantity) >= minimum_quantity` (if set).
4. `usage_count < usage_limit` (if set).

Rules: **one discount per invoice**, the one with the largest amount (stacking is out of scope). It is allocated across target lines proportionally. It then appears automatically on the next invoice, stops when it expires or runs out, and nobody has to remember it.

```python
# app/services/discount_service.py
def compute_discount_amount(base: Decimal, kind: str, value: Decimal) -> Decimal:
    if base <= 0:
        return ZERO
    if kind == "fixed":
        return money(min(value, base))
    return money(base * min(max(value, Decimal("0")), Decimal("100")) / 100)

@dataclass
class Chosen:
    discount: Discount; amount: Decimal; target_lines: list

def pick_best_discount(db, sub, lines, today) -> Chosen | None:
    rows = db.execute(select(Discount).where(
        Discount.is_active.is_(True),
        or_(Discount.starts_on.is_(None), Discount.starts_on <= today),
        or_(Discount.ends_on.is_(None), Discount.ends_on >= today),
    ).order_by(Discount.id).with_for_update().execution_options(populate_existing=True)).scalars().all()
    best = None
    for d in rows:
        if d.usage_limit is not None and d.usage_count >= d.usage_limit:
            continue
        if d.scope == "subscription":
            target = lines
        else:
            pids = set(db.execute(select(DiscountProduct.product_id)
                                  .where(DiscountProduct.discount_id == d.id)).scalars())
            target = [l for l in lines if l.product_id in pids]
        if not target:
            continue
        base = sum((l.subtotal for l in target), ZERO)
        qty = sum(l.quantity for l in target)
        if d.minimum_purchase and base < d.minimum_purchase: continue
        if d.minimum_quantity and qty < d.minimum_quantity: continue
        amount = compute_discount_amount(base, d.discount_type, d.value)
        if amount > 0 and (best is None or amount > best.amount):
            best = Chosen(d, amount, target)
    return best

def allocate_discount(amount: Decimal, target) -> None:
    base = sum((l.subtotal for l in target), ZERO)
    remaining = amount
    for i, l in enumerate(target):
        share = remaining if i == len(target) - 1 else money(amount * l.subtotal / base)
        l.discount, remaining = share, remaining - share      # last line absorbs rounding
```

Locking discount rows (ordered by id, to avoid deadlocks) means concurrent billing cannot exceed `usage_limit`. Only the admin can create or edit discounts.

---

## 14. Payments

Statement: each payment records **method, amount, date and a note**, against the right invoice. Staff and admin record payments (customers view history; online customer payment is optional P3).

```python
@router.post("/payments", status_code=201)
def record_payment(body: PaymentCreate, db: Session = Depends(get_db), user: User = Depends(staff_plus)):
    amount = money(body.amount)
    if amount <= 0:
        raise AppError("INVALID_AMOUNT", "Payment amount must be positive", 422)

    if body.idempotency_key:                                     # replay returns the original
        existing = db.execute(select(Payment).where(
            Payment.idempotency_key == body.idempotency_key)).scalar_one_or_none()
        if existing:
            if existing.invoice_id != body.invoice_id or existing.amount != amount:
                raise AppError("IDEMPOTENCY_MISMATCH", "Key already used for a different payment", 409)
            return existing

    invoice = db.execute(select(Invoice).where(Invoice.id == body.invoice_id)
                         .with_for_update().execution_options(populate_existing=True)).scalar_one_or_none()
    if invoice is None:
        raise AppError("INVOICE_NOT_FOUND", "Invoice not found", 404)
    if invoice.status != "confirmed":
        raise AppError("INVOICE_NOT_PAYABLE", f"Invoice is {invoice.status}; only confirmed invoices accept payments", 409)
    if amount > invoice.balance_due:
        raise AppError("OVERPAYMENT", "Payment exceeds balance due", 422)

    payment = Payment(invoice_id=invoice.id, idempotency_key=body.idempotency_key,
                      payment_reference=body.payment_reference, method=body.method, amount=amount,
                      payment_date=body.payment_date or today_ist(), note=body.note, recorded_by=user.id)
    invoice.amount_paid = money(invoice.amount_paid + amount)
    invoice.balance_due = money(invoice.grand_total - invoice.amount_paid)
    if invoice.balance_due == ZERO:
        invoice.status = "paid"
    db.add(payment)
    audit(db, user, "payment.recorded", "invoice", invoice.id, {"amount": str(amount)})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if body.idempotency_key:
            again = db.execute(select(Payment).where(
                Payment.idempotency_key == body.idempotency_key)).scalar_one_or_none()
            if again:
                return again
        raise AppError("PAYMENT_CONFLICT", "Payment could not be recorded; retry safely", 409)
    db.refresh(payment)
    return payment
```

Example: invoice ₹2,124 → pay ₹1,000 (balance ₹1,124, outstanding) → pay ₹1,124 → balance ₹0 → `paid`.

Frontend: generate `idempotency_key = crypto.randomUUID()` when the payment form opens, and disable submit while pending.

---

## 15. Reports and Metric Definitions (fixed; state them in tooltips)

- **Active subscriptions:** `status = 'active'` AND `start_date <= today` AND (`expiry_date IS NULL OR expiry_date >= today`).
- **Revenue collected (cash basis):** sum of `payments.amount` where `payment_date` is in range.
- **Outstanding:** sum of `balance_due` where `status = 'confirmed'`.
- **Overdue:** `status = 'confirmed' AND balance_due > 0 AND due_date < today`. Report `days_overdue` and bucket `1–30 / 31–60 / 60+`.
- **MRR:** over active subscriptions, `sum(unit_price × quantity)` per subscription (pre-discount, pre-tax), normalised to monthly: daily ×365/12, weekly ×52/12, monthly ×1, yearly ÷12. Paused subscriptions are excluded.
- **Cash collected and MRR are different numbers. Never interchange them.**

Dashboard KPIs: active subscriptions, MRR, revenue in period, outstanding, overdue count and amount, new customers, renewals due in 7 days. Charts: revenue by month, new subscriptions by month, active vs closed, revenue by product, paid vs outstanding. Filters on all views: date range, customer, product/plan, status. Plus a **summary view** (the KPI strip), as the statement requests.

Endpoints (all paginated and filterable): `/api/reports/overview`, `/revenue`, `/subscriptions`, `/overdue`, `/payments`. List endpoints use `page`, `page_size` (max 100) and return `{items, total, page, page_size}`.

---

## 16. Scheduler and Jobs

```python
# app/jobs/scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text

LOCK_BILLING, LOCK_EXPIRY = 710001, 710002
scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

def with_advisory_lock(key, fn):
    with engine.connect() as conn:
        if not conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": key}).scalar():
            return                                     # another instance is running it
        try:
            fn()
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key}); conn.commit()

def start():
    if not settings.ENABLE_SCHEDULER:                 # false under --reload / multiple workers
        return
    scheduler.add_job(lambda: with_advisory_lock(LOCK_BILLING, run_due_billing_job),
                      "cron", hour=1, minute=0, id="billing", max_instances=1, replace_existing=True)
    scheduler.add_job(lambda: with_advisory_lock(LOCK_EXPIRY, close_expired_subscriptions),
                      "cron", hour=2, minute=0, id="expiry", max_instances=1, replace_existing=True)
    scheduler.add_job(send_overdue_reminders, "cron", hour=8, minute=0, id="reminders", replace_existing=True)
    scheduler.start()
```

- **`close_expired_subscriptions`**: for `active` subscriptions with `expiry_date < today` and `plan.auto_close_on_end`, call `transition(..., "closed", user=None, system=True, note="Expired")`, one transaction per subscription. Subscriptions whose plan does not auto-close stay active until staff act (they appear in "renewals due").
- **`send_overdue_reminders`** (P2): invoices overdue by 1 / 3 / 7 days; insert into `notifications` with unique `(invoice_id, kind)` **before** emailing so reruns never duplicate emails.
- Set `ENABLE_SCHEDULER=false` by default in dev; the unique index protects data, but only the advisory lock prevents duplicate side effects.

---

## 17. Billing Day Demo (the differentiator)

### 17.1 Endpoint

```python
# app/routers/simulate.py
router = APIRouter(prefix="/simulate", tags=["simulation"])

@router.post("/billing-day")
def simulate_billing_day(limit: int = Query(default=200, ge=1, le=500), user: User = Depends(admin_only)):
    if not settings.ENABLE_BILLING_SIMULATION:
        raise AppError("SIMULATION_DISABLED", "Simulation is disabled", 403)
    return run_due_billing_job(limit=limit)          # the REAL job. Never backdate rows here.
```

`ENABLE_BILLING_SIMULATION=false` by default; admin only. The endpoint runs the real job and mutates nothing else. Demo data is prepared by `seed_demo.py`. The call is synchronous and returns a completed result object, so do not call it "streaming".

### 17.2 Seed requirements (`scripts/seed_demo.py`, one command)

- Admin `admin@brightloop.test` / `Admin#2026`, one staff user, 40 customers (3 with login accounts). Demo-only credentials; never reuse in production.
- One tax rule (e.g. GST 18%, as *data*), products with the Odoo variant (+₹560), four plans (daily / weekly / monthly / yearly) covering every flag combination (one auto-close, one non-renewable, one no-pause), a 10% volume discount with a usage limit, a quotation template with plan and lines.
- **200 active monthly subscriptions, each exactly one cycle due**: `current_period_start = today`, `next_billing_date = today`, `status = 'active'`, with lines and a tax rule. After one billing run each advances one month and is no longer due.
- A handful of Confirmed invoices at various overdue ages (including one partially paid) and some Paid invoices.
- Verify at the end of the script that exactly 200 eligible subscriptions exist; print an error if not.

### 17.3 Expected behaviour

First click: `{"due_found": 200, "invoices_created": 200, "skipped": 0, "failed": 0}`.
Second click: `{"due_found": 0, "invoices_created": 0, ...}`. UI shows **"Nothing due: everything already billed."**
Then open Invoices → Drafts → **Confirm all**. For repeatable rehearsals, reset and reseed a disposable demo database.

---

## 18. Frontend

### 18.1 Setup

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install axios react-router-dom recharts lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

Add `tailwindcss()` to the Vite plugins and `@import "tailwindcss";` to `src/index.css`.

### 18.2 API client (normalises the error envelope)

```javascript
// src/api/client.js
import axios from "axios";
const client = axios.create({ baseURL: import.meta.env.VITE_API_URL + "/api" });

client.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("access_token");     // hackathon fallback (see §7.3)
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

client.interceptors.response.use((r) => r, (err) => {
  const e = err.response?.data?.error;
  const out = { code: e?.code ?? "NETWORK_ERROR", message: e?.message ?? err.message, status: err.response?.status ?? 0 };
  if (out.status === 401) { localStorage.removeItem("access_token"); window.location.href = "/login"; }
  return Promise.reject(out);
});
export default client;
```

### 18.3 Routing and guards

`AuthContext` loads `/auth/me` on start and exposes `user`, `login`, `logout`, `loading`. Routes: `/admin/*` (roles: admin), `/staff/*` (admin, staff), `/portal/*` (customer), each wrapped in a `ProtectedRoute` that redirects unauthenticated users to `/login` and wrong-role users to `/unauthorized`. UI guards are for UX only; the backend enforces access.

### 18.4 Billing Day button

```jsx
export default function BillingDayButton() {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await client.post("/simulate/billing-day", null, { params: { limit: 200 } });
      setResult(r.data);
    } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <h3 className="font-semibold text-indigo-900">Billing Day</h3>
      <button onClick={run} disabled={busy} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Billing…" : "Run Billing Day"}
      </button>
      {result && (result.due_found === 0
        ? <p className="mt-3 text-sm">Nothing due: everything already billed.</p>
        : <p className="mt-3 font-mono text-sm">Due: {result.due_found} · Invoices created: {result.invoices_created} · Failed: {result.failed}</p>)}
    </div>
  );
}
```

### 18.5 Required screens

- **Public:** login, register, forgot / reset password.
- **Admin:** dashboard (+ Billing Day), staff management, customers, products, variants, plans, tax rules, discounts, quotation templates, quotations, subscriptions, invoices, payments, reports, audit log.
- **Staff:** ops dashboard, customers, quotations, subscriptions, invoices, payments.
- **Customer portal:** overview, available plans, my subscriptions (with allowed actions), my invoices (with PDF), payment history, profile.
- **Everywhere:** subscription status badge and history timeline; invoice status badge with a derived "Overdue" chip; loading, empty and error states; responsive layout.

---

## 19. Performance: Seed, Benchmark, Prove It

Target: every list/report page p95 < 2 s with thousands of rows. **Measure, then claim.**

Seed in dependency order (products → plans → customers → subscriptions → invoices). Use ORM `add_all` for the small tables and **Core bulk inserts** with client-generated UUIDs for the large ones.

```python
# scripts/generate_seed.py  (adjust column names to your models)
from uuid import uuid4
from datetime import date, timedelta
import calendar
from sqlalchemy import insert

def chunks(rows, n=5000):
    for i in range(0, len(rows), n):
        yield rows[i:i + n]

def seed_performance_data(db, n_customers=5_000, n_subs=50_000):
    products = [Product(name=f"Product {i}", product_type="service", sales_price=Decimal("500.00"),
                        cost_price=Decimal("150.00"), is_active=True) for i in range(4)]
    db.add_all(products); db.flush()
    plans = [Plan(product_id=p.id, name=f"Monthly {p.name}", price=Decimal("500.00"), billing_cycle="monthly",
                  minimum_quantity=1, allow_pause=True, allow_early_close=True, allow_renewal=True,
                  auto_close_on_end=False, is_active=True) for p in products]
    db.add_all(plans)
    customers = [Customer(company_name=f"Customer {i}") for i in range(n_customers)]
    db.add_all(customers); db.flush()

    sub_rows, inv_rows = [], []
    for i in range(n_subs):
        sid = uuid4()
        cust = customers[i % n_customers].id
        sub_rows.append(dict(id=sid, subscription_number=f"PERF-SUB-{i:07d}", customer_id=cust,
            plan_id=plans[i % len(plans)].id, status="closed" if i % 10 == 0 else "active",
            start_date=date(2026, 7, 1), current_period_start=date(2026, 11, 1),
            current_period_end=date(2026, 11, 30), next_billing_date=date(2026, 11, 1),
            payment_terms_days=15, auto_renew=False))
        for m in (8, 9, 10):                                   # 3 invoices each -> 150k
            start = date(2026, m, 1)
            end = date(2026, m, calendar.monthrange(2026, m)[1])
            paid = (i + m) % 3 != 0
            inv_rows.append(dict(id=uuid4(), invoice_number=f"PERF-INV-{i:07d}-{m}", customer_id=cust,
                subscription_id=sid, billing_period_start=start, billing_period_end=end,
                issue_date=start, due_date=start + timedelta(days=15),
                subtotal=Decimal("500.00"), discount_total=Decimal("0.00"), tax_total=Decimal("90.00"),
                grand_total=Decimal("590.00"), amount_paid=Decimal("590.00") if paid else Decimal("0.00"),
                balance_due=Decimal("0.00") if paid else Decimal("590.00"),
                status="paid" if paid else "confirmed"))
    for batch in chunks(sub_rows):
        db.execute(insert(Subscription), batch)
    for batch in chunks(inv_rows):
        db.execute(insert(Invoice), batch)
    db.commit()
```

```python
# scripts/benchmark.py
import time, requests
BASE = "http://127.0.0.1:8000/api"
tok = requests.post(f"{BASE}/auth/login", json={"email": "admin@brightloop.test", "password": "Admin#2026"}).json()["access_token"]
H = {"Authorization": f"Bearer {tok}"}

def bench(path, n=30):
    lat = []
    for _ in range(n):
        t = time.perf_counter(); requests.get(BASE + path, headers=H, timeout=10)
        lat.append((time.perf_counter() - t) * 1000)
    lat.sort()
    print(f"{path}: p50={lat[len(lat)//2]:.0f}ms p95={lat[int(len(lat)*0.95)-1]:.0f}ms")

for p in ["/subscriptions?status=active&page=1&page_size=20", "/invoices?status=confirmed&page=1&page_size=20",
          "/payments?page=1&page_size=20", "/reports/overview", "/reports/overdue?page=1&page_size=20"]:
    bench(p)
```

Put measured p50/p95, row counts and hardware in the README. Rules that make it achievable: the §5.2 indexes, server-side pagination and SQL filters on every list, `selectinload` to avoid N+1, connection pooling, PDF/email off the request path, a 60 s cache on the dashboard aggregate if needed.

---

## 20. Migrations (Alembic)

1. Implement **every** model from §5 (including `quotation_template_lines`, `subscription_status_history`, `quotations.plan_id`, `products.default_tax_rule_id`, `subscriptions.expiry_date`, unique and check constraints, indexes).
2. Import all model modules in `app/models/__init__.py` so `Base.metadata` is complete.
3. `alembic init alembic`; in `env.py` set `target_metadata = Base.metadata`, read the URL from settings, and use `compare_type=True`.
4. `alembic revision --autogenerate -m "initial schema"`, then **read the generated file**: verify every table, FK, partial index (`postgresql_where`), CHECK, enum and server default. Autogenerate is a starting point, not proof.
5. Run `alembic upgrade head` on an empty database, then `alembic downgrade base` on a disposable one, then `upgrade head` again.
6. Commit the generated migration. Never use `Base.metadata.create_all()` outside tests.
7. CI runs the up / down / up cycle (§21).

---

## 21. Testing and CI

### 21.1 Implementation gate (all green on **PostgreSQL** before frontend polish)

- [ ] Two simultaneous workers → exactly one invoice per subscription period.
- [ ] Rerun after success → no duplicate; the period is not advanced twice.
- [ ] A failed invoice transaction leaves the subscription's billing dates unchanged.
- [ ] Two simultaneous payments cannot overpay an invoice.
- [ ] Replaying an idempotency key returns the original payment; a mismatched replay → 409.
- [ ] A customer cannot view or act on another customer's invoice/subscription by changing an ID (404).
- [ ] A quotation converts once, including concurrent requests.
- [ ] Discount `usage_limit` cannot be exceeded under concurrent billing.
- [ ] Fresh database migration up / down / up succeeds.
- [ ] Demo seed is valid: plans, subscriptions and FKs all consistent; exactly 200 due.

### 21.2 Test plan

- **Auth:** password rules (8 chars fail, 9 pass, each missing class fails, > 72 bytes fails); duplicate email; customer cannot create staff; reset token expired / used / generic response.
- **Catalog and pricing:** negative prices rejected; Odoo variant = base + 560 **exactly once** through quote → subscription → invoice; plan unavailable outside its dates; minimum quantity enforced.
- **Templates and quotes:** from-template copies lines, sets `valid_until`; expired quote can't convert; convert twice blocked.
- **Lifecycle:** every legal and illegal transition; pause/close/renew obey plan flags for both staff and customers; closed never resumes; history rows written.
- **Billing (critical):** all four cycles including Jan 31 → Feb 28; exact-to-the-paise tax/discount math and header = sum of lines; Draft status at creation; paused/closed/future-dated never billed; past-expiry not billed; invalid tax rule → reported failure and no invoice and no clock advance; discount auto-appears, stops at limit.
- **Invoices:** confirm / cancel rules; cancel blocked after a payment; send requires Confirmed or Paid; PDF built from snapshots.
- **Payments:** partial then full → Paid; overpayment rejected; Draft and Cancelled reject payments.
- **Reports:** active count, revenue date filters, outstanding, overdue derivation and buckets, MRR normalisation.

Concurrency test pattern (separate session per thread):

```python
def test_concurrent_billing_creates_one_invoice(due_subscription_id):
    results = []
    def worker():
        with SessionLocal() as db:
            results.append(generate_invoice_for_subscription(db, due_subscription_id))
    threads = [Thread(target=worker) for _ in range(2)]
    [t.start() for t in threads]; [t.join() for t in threads]
    assert sum(r is not None for r in results) == 1
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Invoice)
                         .where(Invoice.subscription_id == due_subscription_id)) == 1
```

### 21.3 CI

```yaml
# .github/workflows/ci.yml
name: ci
on: [push]
jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: subscriptiq_test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql+psycopg://postgres:test@localhost:5432/subscriptiq_test
      JWT_SECRET: ci-secret
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - run: alembic upgrade head && alembic downgrade base && alembic upgrade head
      - run: pytest -q
  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
```

---

## 22. Optional P3: Razorpay (only if everything else is done)

Skip it unless the core is finished. If attempted: persist a `gateway_orders` row (`invoice_id`, `provider_order_id` unique, `amount_paise`, `currency`, `status`) when creating an order; the webhook verifies the raw-body HMAC signature with `hmac.compare_digest`, handles only captured events, maps `order_id` through `gateway_orders` (it is **not** an invoice id), checks amount and currency, uses the provider payment id as `payment_reference` (unique), and applies the payment under the same invoice row lock as §14. Repeated events return success. Never trust a frontend success redirect.

---

## 23. Security Checklist

- [ ] bcrypt hashes; reset tokens hashed, 15 min, single use
- [ ] Role and ownership checks on every endpoint, in the backend
- [ ] Pydantic validation on all input; ORM / parameterised SQL only
- [ ] Secrets in `.env`; `.env.example` has placeholders only
- [ ] CORS restricted to the frontend origin; HTTPS in production
- [ ] slowapi limits on login / forgot / reset
- [ ] All financial mutations in transactions; unique constraints on money-critical invariants
- [ ] Audit log on user, discount, invoice and payment mutations
- [ ] Simulation endpoint disabled by default and admin-only
- [ ] Demo credentials never reused in production

---

## 24. Acceptance Criteria (traceable to the statement)

| Statement scene | Done when |
|---|---|
| New customer signs up | Registration with unique email and password rules; reset link emailed (or logged in dev); roles enforced in the backend; only the admin can create staff |
| Launching a new plan | Product (name, type, sales/cost price, notes), variant (+560), plan (4 cycles, min qty, dates, all 4 flags) |
| Quote → subscription | Template (plan + lines + validity) → quotation → one-time conversion → subscription with number, customer, plan, start, **expiry**, payment terms, lines |
| Visible lifecycle | Draft → Quotation → Confirmed → Active → Closed (+ Paused) with badge and history |
| Billing day | Draft invoices auto-created with customer, lines, tax and totals; confirm / cancel / send / print; **no duplicates, none skipped** (tests prove it) |
| Better price | Admin-only discounts (fixed / %, min purchase or qty, dates, usage limit; product or subscription scope) auto-applied on the next invoice, stop on expiry or limit |
| Money comes in | Payment with method, amount, date, note against the right invoice; paid vs outstanding visible; overdue derived with aging |
| Finance lead | Dashboard: active subscriptions, revenue, payments, overdue, outstanding, MRR; filters and summary |
| Performance | Measured p50/p95 on the 50k / 150k seed documented in README; all pages < 2 s |
| Quality | CI green; migration up/down/up; A10 gate checked |

---

## 25. 36-Hour Timeline (statement parity first)

| Hours | Deliverable |
|---|---|
| 0–5 | Repo, Postgres, models + Alembic migration, config, error envelope, clock/money helpers |
| 5–10 | Auth, roles, ownership, registration/reset, staff creation |
| 10–15 | Tax rules, products, variants, plans, discounts CRUD (admin-gated) |
| 15–20 | Templates, quotations, conversion, subscription lifecycle + history |
| 20–26 | **Billing engine, invoice lifecycle, payments + the concurrency tests** (do not skip) |
| 26–29 | Reports/dashboard, customer portal |
| 29–31 | Frontend screens polish, Billing Day button, `seed_demo.py` |
| 31–33 | Perf seed + benchmark numbers → README; three full dry runs (bugfix only) |
| 33–35 | Backup screen recording; screenshots for extras |
| 35–36 | Present |

Hard rule: from hour 31, no new features, only stability.

---

## 26. Demo Script (3 minutes, rehearse 3×)

1. **(20 s)** The pain: "Brightloop types invoices by hand and renewals go to whoever notices first. Watch one billing month."
2. **(30 s)** Admin login → create a product with the Odoo variant, a monthly plan and a discount rule.
3. **(25 s)** Template → quotation → accept → convert → subscription (watch the status history).
4. **(60 s) The moment:** "It's billing day, 200 subscriptions due and nobody typing." Click **Run Billing Day** → 200 invoices created. Click again → "Nothing due: everything already billed." *That is the no-double-billing guarantee, live.* Then **Confirm all**.
5. **(30 s)** Open an invoice: discount line, tax, PDF. Record a partial payment → outstanding; record the rest → Paid.
6. **(15 s)** Customer portal in a second browser: only their own data; change the ID in the URL → 404.
7. **(10 s)** Close: "Every scene in the statement, one platform, and billing day is now a button, not a panic."

Backup: record the full run in the last two hours. Never demo an untested feature live.

---

## 27. Build Order for the Coding Agent (Antigravity)

Work in phases and stop for review after each, running the tests every time.

- **Phase 0:** scaffold, Postgres (compose or local), config, `.env.example`, clock, money, errors.
- **Phase 1:** all models from §5, generated migration, up/down/up verified.
- **Phase 2:** auth, security, permissions, rate limiting, audit helper.
- **Phase 3:** tax rules, products, variants, plans, discounts.
- **Phase 4:** templates, quotations, conversion, subscription state machine + history, portal actions.
- **Phase 5:** billing engine, batch job, invoice lifecycle, **§21.1 gate tests**. Do not proceed until green.
- **Phase 6:** payments, reports, scheduler + advisory lock + expiry job.
- **Phase 7:** `seed_demo.py` (200 exactly-due subscriptions), Billing Day endpoint, perf seed, benchmark.
- **Phase 8:** frontend, one role area at a time; Billing Day button last.

**Final rule:** the billing ledger and its invariants are the source of truth. The UI only displays what the database has committed. It never manufactures a success state.
