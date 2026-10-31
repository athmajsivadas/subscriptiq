from typing import Any, Dict, Optional

class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        http_status: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.code = code
        self.message = message
        self.http_status = http_status
        self.details = details or {}
        super().__init__(message)

def envelope(code: str, message: str, details: Optional[Dict[str, Any]] = None) -> dict:
    """Format single error envelope as specified in section 6.4."""
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        }
    }
