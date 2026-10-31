# SubscriptIQ

> Robust, High-Performance Subscription Management System aligned with the Brightloop Software hackathon specification.

## Tech Stack
- **Backend:** FastAPI, Pydantic v2, SQLAlchemy 2.x, PostgreSQL 16, Alembic
- **Frontend:** React + Vite, Tailwind CSS v4, Axios, Recharts, Lucide React
- **Architecture:** Row-locked financial engine, zero float arithmetic (`Numeric(12,2)` / `Decimal`), atomic numbering sequences, PostgreSQL advisory locks for distributed scheduling.

---

## Quick Start & Local Setup

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.12+ / 3.13

### 2. Environment Setup
```bash
# Start PostgreSQL database (Postgres 16 on port 5432)
docker compose up -d

# Create virtual environment
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate # Linux / macOS

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Run database migrations
alembic upgrade head
```

### 3. Seed Demo Data
```bash
python -m scripts.seed_demo
```
This populates:
- Admin & staff accounts
- 40 customers (3 with active customer logins)
- Tax rule (GST 18%)
- Products, including the Odoo variant (+₹560)
- 4 plans covering every lifecycle flag combination
- 10% volume discount with usage limit
- **200 active monthly subscriptions** due today
- Overdue invoices across age buckets (1–30, 31–60, 60+ days) and partially paid balances

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@brightloop.test` | `Admin#2026` |
| **Staff** | `staff@brightloop.test` | `Staff#2026` |
| **Customer 1** | `cust1@brightloop.test` | `Cust1#2026` |
| **Customer 2** | `cust2@brightloop.test` | `Cust2#2026` |
| **Customer 3** | `cust3@brightloop.test` | `Cust3#2026` |

---

## Running the Application
```bash
uvicorn app.main:app --reload --port 8000
```
- Health check: `http://localhost:8000/api/health`
- Interactive API Docs: `http://localhost:8000/docs`

---

## Billing Day Demo
The differentiator workflow can be triggered via:
`POST /api/simulate/billing-day?limit=200`
- **First click:** `{"due_found": 200, "invoices_created": 200, "skipped": 0, "failed": 0}`
- **Second click:** `{"due_found": 0, "invoices_created": 0, "skipped": 0, "failed": 0}` (*Nothing due: everything already billed*)

---

## Performance Benchmarks (Spec §19)

Dataset: **50,000 subscriptions** and **150,000 invoices** seeded via Core bulk inserts.
Measured on Windows 11 / PostgreSQL 16 container (`n=30` requests per endpoint):

| Endpoint | p50 | p95 | Spec Target | Status |
|---|---|---|---|---|
| `GET /api/subscriptions?status=active&page=1&page_size=20` | **65.2 ms** | **70.4 ms** | < 2000 ms | **PASS** |
| `GET /api/invoices?status=confirmed&page=1&page_size=20` | **103.1 ms** | **117.8 ms** | < 2000 ms | **PASS** |
| `GET /api/payments?page=1&page_size=20` | **17.0 ms** | **18.5 ms** | < 2000 ms | **PASS** |
| `GET /api/reports/overview` | **166.1 ms** | **185.4 ms** | < 2000 ms | **PASS** |
| `GET /api/reports/overdue?page=1&page_size=20` | **30.2 ms** | **33.3 ms** | < 2000 ms | **PASS** |

*All endpoints respond well below the 200 ms mark, easily beating the 2.0 s threshold.*

---

## Running Automated Tests
```bash
$env:PYTHONPATH="backend"; backend\venv\Scripts\pytest.exe backend\tests -v
```
All **38 unit, integration, gate (§21.1), and simulation proof tests** pass.
