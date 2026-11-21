import os
import sys
import pymysql

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import ensure_database_exists, engine, Base, SessionLocal
from app.core.seed import seed_database
from app.models.survey import Survey
from app.models.respondent import Respondent
from app.services.survey_service import get_survey_quota_counts
import app.models

def reset_demo_data(target_db: str = None):
    db_name = target_db or os.getenv("MYSQL_DB", "survey_db")
    settings.MYSQL_DB = db_name
    print(f"Resetting demo data in target database: {db_name}...")

    ensure_database_exists(db_name)

    # 1. Drop existing tables safely
    conn = pymysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        database=db_name,
        autocommit=True
    )
    with conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS = 0;")
        cur.execute("SHOW TABLES;")
        tables = [row[0] for row in cur.fetchall()]
        for table in tables:
            cur.execute(f"DROP TABLE IF EXISTS `{table}`;")
        cur.execute("SET FOREIGN_KEY_CHECKS = 1;")
    conn.close()
    print("   Dropped all existing tables.")

    # 2. Recreate schema
    Base.metadata.create_all(bind=engine)
    print("   Recreated 8 database tables cleanly.")

    # 3. Seed demo data (admin, researcher, sample survey LIVE, 0 respondents)
    db = SessionLocal()
    try:
        seed_database(db)
        
        # 4. Verify survey and zero respondents
        survey = db.query(Survey).filter(Survey.slug == "smartphone_study").first()
        if not survey:
            print("ERROR: Sample survey not seeded.")
            return False

        resp_count = db.query(Respondent).filter(Respondent.survey_id == survey.id).count()
        comp_count = db.query(Respondent).filter(Respondent.survey_id == survey.id, Respondent.status == "COMPLETED").count()
        term_count = db.query(Respondent).filter(Respondent.survey_id == survey.id, Respondent.status == "TERMINATED").count()
        prog_count = db.query(Respondent).filter(Respondent.survey_id == survey.id, Respondent.status == "IN_PROGRESS").count()

        print("\n=== Demo Reset Verification ===")
        print(f"Database:        {db_name}")
        print(f"Survey Slug:     {survey.slug}")
        print(f"Survey Status:   {survey.status}")
        print(f"Target:          {survey.target}")
        print(f"Started:         {resp_count}")
        print(f"Completed:       {comp_count}")
        print(f"Terminated:      {term_count}")
        print(f"In Progress:     {prog_count}")
        print("Quotas Initialized:")
        for q in survey.quotas:
            print(f"  - [{q.question_id}={q.value}]: target {q.target}, done 0, left {q.target}")
        print("================================")

        assert comp_count == 0, f"Expected 0 completes, got {comp_count}"
        assert resp_count == 0, f"Expected 0 respondents, got {resp_count}"
        print("\nSUCCESS: Demo data reset complete. Dashboard shows ZERO completes.\n")
        return True
    finally:
        db.close()

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    success = reset_demo_data(target)
    sys.exit(0 if success else 1)
