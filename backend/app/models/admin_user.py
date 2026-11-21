from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base

class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(16), nullable=False) # 'admin' or 'researcher'
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
