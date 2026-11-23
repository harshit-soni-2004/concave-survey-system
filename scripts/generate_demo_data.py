import os
import sys
import uuid
import random
import argparse
from datetime import datetime, timedelta

# Ensure root and backend directory are in sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.models.survey import Survey
from app.models.survey_version import SurveyVersion
from app.models.respondent import Respondent
from app.models.answer import Answer
from app.models.answer_option import AnswerOption
from app.models.respondent_termination import RespondentTermination
from app.services.survey_service import complete_survey_with_lock

def generate_demo_dataset(count: int = 150, clean: bool = False):
    """
    Populates realistic respondent survey data across sample surveys:
    - Distributed over the last 12 days
    - Authentic answer variations
    - Quality flags: speeders (< 1/3 median duration) & straight-liners (identical matrix answers)
    - Terminations: screener dropouts at q4 / q5 with logged reasons
    - Quota and nested quota tracking
    - In-progress sessions
    """
    db_name = os.getenv("MYSQL_DB", "survey_db")
    settings.MYSQL_DB = db_name
    print(f"\n=======================================================")
    print(f"Generating {count} demo records for database: {db_name}")
    print(f"=======================================================\n")

    if clean:
        print("Cleaning previous respondent records before generation...")
        from scripts.reset_demo import reset_demo_data
        reset_demo_data(db_name)

    db = SessionLocal()
    try:
        # 1. Fetch sample surveys
        surveys = db.query(Survey).filter(
            Survey.slug.in_(["smartphone_study", "bonus_feature_demo"])
        ).all()

        if not surveys:
            print("ERROR: Sample surveys not found. Please run seed_database first.")
            return False

        now = datetime.utcnow()

        for survey in surveys:
            version = db.query(SurveyVersion).filter(
                SurveyVersion.id == survey.active_version_id
            ).first() or db.query(SurveyVersion).filter(
                SurveyVersion.survey_id == survey.id
            ).first()

            if not version:
                continue

            target_completes = min(count // len(surveys), survey.target or 100)
            target_screenouts = int(target_completes * 0.25)
            target_in_progress = 6

            print(f"-> Populating '{survey.title}' (slug: {survey.slug})")
            print(f"   Target completes: ~{target_completes}, Screenouts: ~{target_screenouts}, In-progress: {target_in_progress}")

            # Base median time: ~180 seconds (3 mins). Speeders will have < 60s
            durations = []

            # -------------------------------------------------------------
            # A. COMPLETED RESPONDENTS
            # -------------------------------------------------------------
            completed_created = 0
            for i in range(target_completes):
                # Spread timestamps over the last 12 days
                days_ago = random.uniform(0.1, 11.9)
                started_at = now - timedelta(days=days_ago)

                # Determine if this respondent is a speeder (~10% probability, minimum 2)
                is_speeder = (i < 2) or (random.random() < 0.10)
                if is_speeder:
                    duration_sec = random.randint(25, 45) # Fast (< 1/3 median)
                else:
                    duration_sec = random.randint(120, 360) # Realistic normal duration

                completed_at = started_at + timedelta(seconds=duration_sec)
                durations.append(duration_sec)

                resp_id = str(uuid.uuid4())
                resp_token = f"token_{uuid.uuid4().hex[:12]}"

                # Meta for bonus feature tracking
                meta = {
                    "language": random.choice(["en", "hi"]) if survey.slug == "bonus_feature_demo" else "en",
                    "rotation_arm": random.choice(["AB", "BA"]) if survey.slug == "bonus_feature_demo" else None
                }

                respondent = Respondent(
                    id=resp_id,
                    survey_id=survey.id,
                    survey_version_id=version.id,
                    token=resp_token,
                    status="IN_PROGRESS", # will complete through complete_survey_with_lock
                    started_at=started_at,
                    updated_at=completed_at,
                    is_test=False,
                    current_question_id="completed",
                    meta=meta
                )
                db.add(respondent)
                db.flush()

                # Generate realistic answers based on survey
                is_straightliner = (i == 2 or i == 3) or (random.random() < 0.08)

                if survey.slug == "smartphone_study":
                    _create_smartphone_answers(db, resp_id, is_straightliner)
                else:
                    _create_bonus_answers(db, resp_id, is_straightliner)

                # Use real complete_survey_with_lock to verify and enforce quotas & target
                status, reason = complete_survey_with_lock(resp_id, db)
                if status == "COMPLETED":
                    # Override completed_at to maintain our spread over the last 12 days
                    resp_ref = db.query(Respondent).filter(Respondent.id == resp_id).first()
                    if resp_ref:
                        resp_ref.started_at = started_at
                        resp_ref.completed_at = completed_at
                        resp_ref.updated_at = completed_at
                        db.commit()
                    completed_created += 1
                elif status == "TERMINATED":
                    # Quota full termination occurred
                    pass

            # -------------------------------------------------------------
            # B. SCREENOUT / TERMINATED RESPONDENTS (q4 / q5 failures)
            # -------------------------------------------------------------
            for j in range(target_screenouts):
                days_ago = random.uniform(0.1, 11.9)
                started_at = now - timedelta(days=days_ago)
                term_at = started_at + timedelta(seconds=random.randint(15, 45))

                resp_id = str(uuid.uuid4())
                resp_token = f"term_{uuid.uuid4().hex[:12]}"

                # Screenout at city (q4) or smartphone user (q5)
                screenout_type = random.choice(["city", "smartphone"])
                if survey.slug == "smartphone_study":
                    if screenout_type == "city":
                        q_id = "q4"
                        q_opt = "Other city"
                        reason = "City not in scope"
                    else:
                        q_id = "q5"
                        q_opt = "No"
                        reason = "Not a smartphone user"
                else:
                    if screenout_type == "city":
                        q_id = "q_city"
                        q_opt = "Other"
                        reason = "Tier-1 location criteria not met"
                    else:
                        q_id = "q_smartphone"
                        q_opt = "No"
                        reason = "Not an active smartphone owner"

                respondent = Respondent(
                    id=resp_id,
                    survey_id=survey.id,
                    survey_version_id=version.id,
                    token=resp_token,
                    status="TERMINATED",
                    termination_reason=f"{q_id}: {reason}",
                    started_at=started_at,
                    completed_at=None,
                    updated_at=term_at,
                    is_test=False,
                    current_question_id=q_id,
                    meta={}
                )
                db.add(respondent)
                db.flush()

                # Add terminating answer
                ans = Answer(
                    respondent_id=resp_id,
                    question_id=q_id,
                    answer_value=q_opt,
                    created_at=term_at
                )
                db.add(ans)
                db.flush()

                ao = AnswerOption(
                    answer_id=ans.id,
                    question_id=q_id,
                    option_value=q_opt,
                    created_at=term_at
                )
                db.add(ao)

                # Log termination reason in respondent_terminations
                term_log = RespondentTermination(
                    respondent_id=resp_id,
                    question_id=q_id,
                    reason=reason,
                    created_at=term_at
                )
                db.add(term_log)
                db.commit()

            # -------------------------------------------------------------
            # C. IN-PROGRESS RESPONDENTS
            # -------------------------------------------------------------
            for k in range(target_in_progress):
                started_at = now - timedelta(minutes=random.randint(5, 180))
                resp_id = str(uuid.uuid4())
                resp_token = f"prog_{uuid.uuid4().hex[:12]}"

                respondent = Respondent(
                    id=resp_id,
                    survey_id=survey.id,
                    survey_version_id=version.id,
                    token=resp_token,
                    status="IN_PROGRESS",
                    started_at=started_at,
                    updated_at=started_at,
                    is_test=False,
                    current_question_id="q6" if survey.slug == "smartphone_study" else "q_matrix_eval",
                    meta={}
                )
                db.add(respondent)
                db.flush()

                # Record consent
                ans = Answer(
                    respondent_id=resp_id,
                    question_id="q1" if survey.slug == "smartphone_study" else "q_consent",
                    answer_value="Yes",
                    created_at=started_at
                )
                db.add(ans)
                db.commit()

            print(f"   Successfully generated records for {survey.slug} ({completed_created} completes).")

        print("\nAll demo data generation completed successfully!")
        return True

    except Exception as e:
        db.rollback()
        print(f"Error generating demo data: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

def _create_smartphone_answers(db, resp_id: str, is_straightliner: bool):
    now = datetime.utcnow()
    # q1 Consent
    a1 = Answer(respondent_id=resp_id, question_id="q1", answer_value="Yes", created_at=now)
    db.add(a1)
    # q2 Age
    a2 = Answer(respondent_id=resp_id, question_id="q2", answer_value=random.randint(21, 48), created_at=now)
    db.add(a2)
    # q3 Gender (Quota: Male / Female)
    gen = random.choice(["Male", "Female"])
    a3 = Answer(respondent_id=resp_id, question_id="q3", answer_value=gen, created_at=now)
    db.add(a3)
    db.flush()
    db.add(AnswerOption(answer_id=a3.id, question_id="q3", option_value=gen, created_at=now))

    # q4 City (Quota: Mumbai / Pune / Delhi / Bengaluru)
    city = random.choice(["Mumbai", "Pune", "Delhi", "Bengaluru"])
    a4 = Answer(respondent_id=resp_id, question_id="q4", answer_value=city, created_at=now)
    db.add(a4)
    db.flush()
    db.add(AnswerOption(answer_id=a4.id, question_id="q4", option_value=city, created_at=now))

    # q5 Smartphone User
    a5 = Answer(respondent_id=resp_id, question_id="q5", answer_value="Yes", created_at=now)
    db.add(a5)

    # q6 Brands used (Multi)
    all_brands = ["Samsung", "Apple", "Xiaomi", "OnePlus", "Vivo", "Oppo"]
    chosen_brands = random.sample(all_brands, k=random.randint(1, 3))
    a6 = Answer(respondent_id=resp_id, question_id="q6", answer_value=chosen_brands, created_at=now)
    db.add(a6)
    db.flush()
    for b in chosen_brands:
        db.add(AnswerOption(answer_id=a6.id, question_id="q6", option_value=b, created_at=now))

    # q7 Primary brand
    pri_brand = random.choice(chosen_brands)
    a7 = Answer(respondent_id=resp_id, question_id="q7", answer_value=pri_brand, created_at=now)
    db.add(a7)

    # q8 Rating
    rate = random.choices([1, 2, 3, 4, 5], weights=[5, 10, 25, 40, 20])[0]
    a8 = Answer(respondent_id=resp_id, question_id="q8", answer_value=rate, created_at=now)
    db.add(a8)

    # q10 NPS (0 to 10)
    nps_val = random.choices(list(range(11)), weights=[2, 2, 3, 3, 4, 6, 8, 15, 20, 22, 15])[0]
    a10 = Answer(respondent_id=resp_id, question_id="q10", answer_value=nps_val, created_at=now)
    db.add(a10)

    # q11 Matrix (4 rows)
    rows = ["The battery lasts a full day", "The camera takes good photos", "It works smoothly without lag", "It was good value for money"]
    opts = ["Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree"]
    matrix_val = {}
    if is_straightliner:
        uniform_ans = random.choice(["Agree", "Neutral", "Strongly agree"])
        for r in rows:
            matrix_val[r] = uniform_ans
    else:
        for r in rows:
            matrix_val[r] = random.choices(opts, weights=[25, 45, 15, 10, 5])[0]

    a11 = Answer(respondent_id=resp_id, question_id="q11", answer_value=matrix_val, created_at=now)
    db.add(a11)

    # q12 Buy new phone in 6 months
    buy_soon = random.choice(["Yes", "No"])
    a12 = Answer(respondent_id=resp_id, question_id="q12", answer_value=buy_soon, created_at=now)
    db.add(a12)

    db.commit()

def _create_bonus_answers(db, resp_id: str, is_straightliner: bool):
    now = datetime.utcnow()
    # q_consent
    db.add(Answer(respondent_id=resp_id, question_id="q_consent", answer_value="Yes", created_at=now))

    # q_gen (Quota: Male / Female)
    gen = random.choice(["Male", "Female"])
    a_gen = Answer(respondent_id=resp_id, question_id="q_gen", answer_value=gen, created_at=now)
    db.add(a_gen)
    db.flush()
    db.add(AnswerOption(answer_id=a_gen.id, question_id="q_gen", option_value=gen, created_at=now))

    # q_city (Nested Quotas with q_gen)
    city = random.choice(["Mumbai", "Delhi", "Bengaluru", "Pune"])
    a_city = Answer(respondent_id=resp_id, question_id="q_city", answer_value=city, created_at=now)
    db.add(a_city)
    db.flush()
    db.add(AnswerOption(answer_id=a_city.id, question_id="q_city", option_value=city, created_at=now))

    # q_smartphone
    db.add(Answer(respondent_id=resp_id, question_id="q_smartphone", answer_value="Yes", created_at=now))

    # q_matrix_eval (4 rows)
    rows = ["Battery Longevity", "Camera Quality", "Display Clarity", "Build & Design"]
    opts = ["1 - Very Poor", "2 - Poor", "3 - Neutral", "4 - Good", "5 - Excellent"]
    m_val = {}
    if is_straightliner:
        u_ans = random.choice(["4 - Good", "5 - Excellent", "3 - Neutral"])
        for r in rows:
            m_val[r] = u_ans
    else:
        for r in rows:
            m_val[r] = random.choices(opts, weights=[5, 10, 20, 45, 20])[0]

    db.add(Answer(respondent_id=resp_id, question_id="q_matrix_eval", answer_value=m_val, created_at=now))

    # Concept evaluations
    db.add(Answer(respondent_id=resp_id, question_id="q_concept_a", answer_value=random.randint(2, 5), created_at=now))
    db.add(Answer(respondent_id=resp_id, question_id="q_concept_b", answer_value=random.randint(2, 5), created_at=now))

    # NPS
    nps_val = random.choices(list(range(11)), weights=[1, 1, 2, 2, 3, 5, 10, 18, 25, 20, 13])[0]
    db.add(Answer(respondent_id=resp_id, question_id="q_nps", answer_value=nps_val, created_at=now))

    db.commit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate realistic demo survey respondents.")
    parser.add_argument("--count", type=int, default=150, help="Total respondents count to generate across surveys.")
    parser.add_argument("--clean", action="store_true", help="Clean existing respondents and reset demo before populating.")
    args = parser.parse_args()

    success = generate_demo_dataset(count=args.count, clean=args.clean)
    sys.exit(0 if success else 1)
