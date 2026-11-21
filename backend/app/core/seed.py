import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.admin_user import AdminUser
from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.models.quota import Quota
from app.parser.parser import parse_questionnaire

DEMO_USERS = [
    {
        "email": os.getenv("ADMIN_EMAIL", "admin@concave.com"),
        "password": os.getenv("ADMIN_PASSWORD", "AdminPassword123!"),
        "name": "Concave Administrator",
        "role": "admin"
    },
    {
        "email": os.getenv("RESEARCHER_EMAIL", "researcher@concave.com"),
        "password": os.getenv("RESEARCHER_PASSWORD", "ResearcherPassword123!"),
        "name": "Senior Researcher",
        "role": "researcher"
    }
]

def seed_database(db: Session = None):
    should_close = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        should_close = True

    try:
        # 1. Seed demo users
        admin_user_obj = None
        for u in DEMO_USERS:
            existing = db.query(AdminUser).filter(AdminUser.email == u["email"]).first()
            if not existing:
                user = AdminUser(
                    email=u["email"],
                    password_hash=get_password_hash(u["password"]),
                    name=u["name"],
                    role=u["role"],
                    created_at=datetime.utcnow()
                )
                db.add(user)
                db.flush()
                if u["role"] == "admin":
                    admin_user_obj = user
            else:
                if u["role"] == "admin":
                    admin_user_obj = existing

        # 2. Seed sample survey if not already present
        sample_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "samples", "concave_sample_questionnaire.txt")
        if os.path.exists(sample_path):
            with open(sample_path, "r", encoding="utf-8") as f:
                raw_text = f.read()

            ast = parse_questionnaire(raw_text)
            survey_slug = ast.get("id") or "smartphone_study"
            existing_survey = db.query(Survey).filter(Survey.slug == survey_slug).first()

            if not existing_survey:
                now = datetime.utcnow()
                deadline = now + timedelta(days=15)
                survey = Survey(
                    slug=survey_slug,
                    title=ast.get("title", "Smartphone Usage Study"),
                    target=ast.get("target", 200),
                    status="LIVE",
                    created_by=admin_user_obj.id if admin_user_obj else None,
                    deadline_at=deadline,
                    created_at=now,
                    updated_at=now
                )
                db.add(survey)
                db.flush()

                version = SurveyVersion(
                    survey_id=survey.id,
                    version_number=1,
                    questionnaire_data=ast,
                    raw_content=raw_text,
                    status="APPROVED",
                    uploaded_by=admin_user_obj.id if admin_user_obj else None,
                    approved_by=admin_user_obj.id if admin_user_obj else None,
                    approved_at=now,
                    created_at=now
                )
                db.add(version)
                db.flush()

                survey.active_version_id = version.id

                # Seed quotas
                for q in ast.get("quotas", []):
                    quota_record = Quota(
                        survey_id=survey.id,
                        question_id=q["question_id"],
                        value=q["value"],
                        target=q["target"],
                        created_at=now
                    )
                    db.add(quota_record)

                db.commit()
                print("Sample survey seeded and approved successfully.")
            else:
                db.commit()
        else:
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        if should_close:
            db.close()

if __name__ == "__main__":
    seed_database()
