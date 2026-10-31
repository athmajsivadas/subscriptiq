import os
import subprocess
import psycopg

DB_NAME = "subscriptiq_downgrade_verify"
CONN_STR = "postgresql://subscriptiq:subscriptiq@localhost:5432/postgres"
TARGET_URL = f"postgresql+psycopg://subscriptiq:subscriptiq@localhost:5432/{DB_NAME}"

def run():
    print(f"--- 1. Recreating clean database {DB_NAME} ---")
    with psycopg.connect(CONN_STR, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
            cur.execute(f"CREATE DATABASE {DB_NAME} OWNER subscriptiq;")

    env = os.environ.copy()
    env["DATABASE_URL"] = TARGET_URL

    alembic_bin = os.path.join(os.path.dirname(__file__), "..", "venv", "Scripts", "alembic.exe")
    if not os.path.exists(alembic_bin):
        alembic_bin = "alembic"

    print("\n--- 2. Running 'alembic upgrade head' ---")
    res1 = subprocess.run([alembic_bin, "upgrade", "head"], cwd="backend", env=env, capture_output=True, text=True)
    print(res1.stdout)
    if res1.stderr:
        print(res1.stderr)

    print("\n--- 3. Running 'alembic downgrade base' ---")
    res2 = subprocess.run([alembic_bin, "downgrade", "base"], cwd="backend", env=env, capture_output=True, text=True)
    print(res2.stdout)
    if res2.stderr:
        print(res2.stderr)

    print("\n--- 4. Querying \\dt on the database ---")
    res3 = subprocess.run(
        ["docker", "exec", "subscriptiq_postgres", "psql", "-U", "subscriptiq", "-d", DB_NAME, "-c", "\\dt"],
        capture_output=True,
        text=True
    )
    print(res3.stdout)
    if res3.stderr:
        print(res3.stderr)

if __name__ == "__main__":
    run()
