import psycopg

CONN_STR = "postgresql://subscriptiq:subscriptiq@localhost:5432/subscriptiq"

QUERIES = [
    (
        "1. Table Row Counts",
        "SELECT 'subscriptions' AS table_name, count(*) AS count FROM subscriptions UNION ALL SELECT 'invoices', count(*) FROM invoices UNION ALL SELECT 'customers', count(*) FROM customers;"
    ),
    (
        "2. EXPLAIN ANALYZE: Active Subscriptions List (Spec §19)",
        "EXPLAIN (ANALYZE, BUFFERS) SELECT id, subscription_number, customer_id, plan_id, status, next_billing_date FROM subscriptions WHERE status = 'active' ORDER BY next_billing_date, id LIMIT 20;"
    ),
    (
        "3. EXPLAIN ANALYZE: Confirmed Invoices List (Spec §19)",
        "EXPLAIN (ANALYZE, BUFFERS) SELECT id, invoice_number, customer_id, status, due_date, balance_due FROM invoices WHERE status = 'confirmed' ORDER BY due_date, id LIMIT 20;"
    ),
    (
        "4. EXPLAIN ANALYZE: Overdue Report Query (Spec §17)",
        "EXPLAIN (ANALYZE, BUFFERS) SELECT id, invoice_number, customer_id, due_date, balance_due FROM invoices WHERE status = 'confirmed' AND due_date < '2026-10-31' ORDER BY due_date ASC, id ASC LIMIT 20;"
    ),
]

def main():
    with psycopg.connect(CONN_STR) as conn:
        with conn.cursor() as cur:
            for title, sql in QUERIES:
                print(f"\n=======================================================")
                print(f"=== {title} ===")
                print(f"=======================================================")
                print(f"SQL: {sql}\n")
                cur.execute(sql)
                rows = cur.fetchall()
                for r in rows:
                    if len(r) == 1:
                        print(r[0])
                    else:
                        print(" | ".join(str(c) for c in r))

if __name__ == "__main__":
    main()
