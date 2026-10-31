"""
Benchmark: measure p50/p95 latency for list and report endpoints per section 19.
Run: cd backend && python -m scripts.benchmark
Requires the server running at http://127.0.0.1:8000
"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

BASE = "http://127.0.0.1:8000/api"

def get_token():
    with httpx.Client() as client:
        res = client.post(f"{BASE}/auth/login", json={
            "email": "admin@brightloop.test",
            "password": "Admin#2026"
        })
        if res.status_code != 200:
            print(f"Login failed: {res.status_code} {res.text}")
            sys.exit(1)
        return res.json()["access_token"]

def bench(path, headers, n=30):
    lat = []
    with httpx.Client() as client:
        for _ in range(n):
            t = time.perf_counter()
            r = client.get(BASE + path, headers=headers, timeout=10.0)
            if r.status_code not in (200, 201):
                print(f"Warning: {path} returned status {r.status_code}")
            lat.append((time.perf_counter() - t) * 1000)
    lat.sort()
    p50 = lat[len(lat) // 2]
    p95 = lat[int(len(lat) * 0.95) - 1]
    print(f"{path}: p50={p50:.1f}ms p95={p95:.1f}ms")
    return p50, p95

def main():
    tok = get_token()
    H = {"Authorization": f"Bearer {tok}"}

    print("\n=== SubscriptIQ Performance Benchmark (Spec §19) ===\n")

    paths = [
        "/subscriptions?status=active&page=1&page_size=20",
        "/invoices?status=confirmed&page=1&page_size=20",
        "/payments?page=1&page_size=20",
        "/reports/overview",
        "/reports/overdue?page=1&page_size=20",
    ]

    results = {}
    for p in paths:
        p50, p95 = bench(p, H)
        results[p] = (p50, p95)

    print("\n=== Summary ===")
    all_pass = True
    for path, (p50, p95) in results.items():
        status = "[PASS]" if p95 < 2000 else "[SLOW]"
        if p95 >= 2000:
            all_pass = False
        print(f"  {status} | {path}: p50={p50:.1f}ms p95={p95:.1f}ms")

    if all_pass:
        print("\n[SUCCESS] All measured endpoints comfortably under 2s target!\n")
    else:
        print("\n[WARNING] Some endpoints exceed 2s p95 - indexes may need tuning.\n")

    return results

if __name__ == "__main__":
    main()
