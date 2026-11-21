from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Concave Insights Survey API",
        "version": "1.0.0"
    }
