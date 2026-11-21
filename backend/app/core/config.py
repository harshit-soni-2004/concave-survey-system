from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Concave Insights Custom Survey System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "survey_user")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "survey_password")
    MYSQL_DB: str = os.getenv("MYSQL_DB", "survey_db")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "concave_insights_super_secret_key_change_in_prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:4200",
        "http://localhost:8000",
        "http://127.0.0.1:4200",
        "http://127.0.0.1:8000",
    ]

    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset=utf8mb4"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
