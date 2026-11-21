import os
import pytest

# Ensure all tests run strictly against survey_test, never survey_db
TEST_DB = os.environ.get("TEST_MYSQL_DB", "survey_test")
os.environ["MYSQL_DB"] = TEST_DB

from app.core.config import settings
settings.MYSQL_DB = TEST_DB

from app.core.database import ensure_database_exists, engine, Base, SessionLocal
from app.core.seed import seed_database
import app.models # Ensure all models are registered with Base.metadata

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    ensure_database_exists(TEST_DB)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield
