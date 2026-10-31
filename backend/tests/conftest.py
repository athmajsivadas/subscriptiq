import os
import subprocess
import pytest
from sqlalchemy import create_engine, text
from app.core.config import settings

@pytest.fixture(scope="session", autouse=True)
def setup_test_schema():
    """Build schema with Alembic upgrade head once per test session."""
    test_db_url = settings.TEST_DATABASE_URL
    env = os.environ.copy()
    env["DATABASE_URL"] = test_db_url
    env["PYTHONPATH"] = "backend"

    # Ensure clean database before running migrations
    engine = create_engine(test_db_url)
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.commit()

    res = subprocess.run(
        ["backend/venv/Scripts/alembic.exe", "upgrade", "head"],
        cwd="backend",
        env=env,
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0, f"Alembic upgrade head failed: {res.stderr}"

@pytest.fixture(autouse=True)
def clean_tables_between_tests():
    """Truncate all tables (RESTART IDENTITY CASCADE) between tests."""
    yield
    engine = create_engine(settings.TEST_DATABASE_URL)
    with engine.connect() as conn:
        # Disable triggers and truncate all user tables except alembic_version
        tables_res = conn.execute(text("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' AND tablename != 'alembic_version';
        """)).scalars().all()
        
        if tables_res:
            table_list = ", ".join(f'"{t}"' for t in tables_res)
            conn.execute(text(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE;"))
            conn.commit()
