import pytest
from sqlalchemy import create_engine, text
from app.core.config import settings

def test_postgres_main_db_connection():
    # Strict rule: Postgres only, never SQLite
    assert "postgresql" in settings.DATABASE_URL
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT current_database(), version();")).fetchone()
        assert result is not None
        assert result[0] == "subscriptiq"
        assert "PostgreSQL" in result[1]

def test_postgres_test_db_connection():
    # Strict rule: Separate test database named subscriptiq_test
    assert "postgresql" in settings.TEST_DATABASE_URL
    assert "subscriptiq_test" in settings.TEST_DATABASE_URL
    engine = create_engine(settings.TEST_DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT current_database(), version();")).fetchone()
        assert result is not None
        assert result[0] == "subscriptiq_test"
        assert "PostgreSQL" in result[1]
