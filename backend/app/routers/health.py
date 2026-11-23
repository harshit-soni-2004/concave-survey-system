from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter(tags=["health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "Concave Insights Survey API",
        "version": "1.0.0",
        "database": db_status,
        "database_engine": "MySQL 8.0"
    }
