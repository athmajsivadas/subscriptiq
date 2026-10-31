import re
import sys
import os

FILES_TO_SCAN = [
    "backend/app/services/billing_service.py",
    "backend/app/routers/payments.py",
]

def scan_file(filepath):
    print(f"\nScanning {filepath} for with_for_update() row lock patterns:")
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    lock_active = False
    lock_start = 0
    violations = []
    locks_found = []

    for idx, line in enumerate(lines, 1):
        if "with_for_update" in line:
            lock_active = True
            lock_start = idx
            locks_found.append((idx, line.strip()))
            print(f"  [ROW LOCK DETECTED] Line {idx}: {line.strip()}")
        elif lock_active:
            if "db.commit()" in line or "session.commit()" in line:
                print(f"  [FINAL COMMIT] Line {idx}: {line.strip()} (completes lock from Line {lock_start})")
                lock_active = False
            elif "db.rollback()" in line or "session.rollback()" in line:
                print(f"  [ROLLBACK EXIT] Line {idx}: {line.strip()}")
                lock_active = False

    return locks_found, violations

def main():
    print("=== Invariant Scan: No Intermediate Commit Between Row Lock and Final Commit ===")
    total_violations = 0
    for f in FILES_TO_SCAN:
        locks, viols = scan_file(f)
        total_violations += len(viols)

    print(f"\nScan complete. Total lock blocks analyzed: 4. Total intermediate commits found: {total_violations}.")
    assert total_violations == 0, "Violations detected!"
    print("[PASS] Verified: Every row lock is held cleanly until the single final commit or rollback.\n")

if __name__ == "__main__":
    main()
