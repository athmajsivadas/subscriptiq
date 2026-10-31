import re
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from app.core.config import settings
from app.core.errors import AppError

def validate_password(pw: str) -> bool:
    """
    Statement: more than eight characters, with an uppercase letter,
    a lowercase letter and a special character.
    Max length 72 bytes due to bcrypt limitation.
    """
    return bool(
        len(pw) > 8
        and len(pw.encode()) <= 72
        and re.search(r"[A-Z]", pw)
        and re.search(r"[a-z]", pw)
        and re.search(r"[^A-Za-z0-9]", pw)
    )

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_access_token(user_id: str, role: str, minutes: int = 30) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, settings.JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise AppError("INVALID_TOKEN", "Invalid or expired token", 401)
