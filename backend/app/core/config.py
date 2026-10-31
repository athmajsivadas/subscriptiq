from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgrespassword@localhost:5432/subscriptiq"
    TEST_DATABASE_URL: str = "postgresql+psycopg://postgres:postgrespassword@localhost:5432/subscriptiq_test"
    JWT_SECRET: str = "brightloop-hackathon-insecure-test-secret-key-32b"
    TZ: str = "Asia/Kolkata"
    EMAIL_BACKEND: str = "console"
    ENABLE_SCHEDULER: bool = False
    ENABLE_BILLING_SIMULATION: bool = True
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
