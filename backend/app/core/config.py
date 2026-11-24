from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Concave Insights Custom Survey System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database
    MYSQL_HOST: str = os.getenv("MYSQL_HOST") or os.getenv("MYSQLHOST") or "localhost"
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT") or os.getenv("MYSQLPORT") or 3306)
    MYSQL_USER: str = os.getenv("MYSQL_USER") or os.getenv("MYSQLUSER") or "survey_user"
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD") or os.getenv("MYSQLPASSWORD") or "survey_password"
    MYSQL_DB: str = os.getenv("MYSQL_DB") or os.getenv("MYSQLDATABASE") or "survey_db"
    DATABASE_URL_ENV: str = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL") or ""
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "concave_insights_super_secret_key_change_in_prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "*",
        "http://localhost",
        "http://localhost:4200",
        "http://localhost:8000",
        "http://127.0.0.1:4200",
        "http://127.0.0.1:8000",
    ]

    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_URL_ENV:
            url = self.DATABASE_URL_ENV
            if url.startswith("mysql://"):
                url = url.replace("mysql://", "mysql+pymysql://", 1)
            return url
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset=utf8mb4"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
