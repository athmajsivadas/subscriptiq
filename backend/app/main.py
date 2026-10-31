from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.errors import AppError, envelope
from app.routers.auth import router as auth_router, limiter

app = FastAPI(
    title="SubscriptIQ API",
    description="Subscription Management System Backend",
    version="1.0.0",
)

app.state.limiter = limiter

# Rate limit exceeded handler to return section 6.4 envelope
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content=envelope("RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Please try again later."),
    )

# CORS restricted strictly to FRONTEND_URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handlers: return section 6.4 envelope for all error types
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.http_status,
        content=envelope(exc.code, exc.message, exc.details),
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    code = "HTTP_ERROR"
    if exc.status_code == 401:
        code = "UNAUTHENTICATED"
    elif exc.status_code == 403:
        code = "FORBIDDEN"
    elif exc.status_code == 404:
        code = "NOT_FOUND"
    message = str(exc.detail) if exc.detail else "An HTTP error occurred"
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope(code, message),
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=envelope(
            "VALIDATION_ERROR",
            "Invalid request parameters or payload",
            {"errors": exc.errors()},
        ),
    )

# Include Routers
app.include_router(auth_router, prefix="/api")

@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok"}
