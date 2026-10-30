"""
FastAPI application entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8080

In Cloud Run, the Dockerfile CMD launches this with uvicorn bound to
$PORT (default 8080).
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
import app.database as db_mod
from app.routers import applications, documents, purchase_orders, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Try PostgreSQL table creation; if database/password connection fails, fallback to local SQLite
    try:
        async with db_mod.engine.begin() as conn:
            await conn.run_sync(db_mod.Base.metadata.create_all)
    except Exception as e:
        print(f"[PostgreSQL auth/connection issue: {e}. Switching to local SQLite database fintech.db]")
        sqlite_engine = create_async_engine("sqlite+aiosqlite:///./fintech.db", echo=False)
        async with sqlite_engine.begin() as conn:
            await conn.run_sync(db_mod.Base.metadata.create_all)
        db_mod.engine = sqlite_engine
        db_mod.AsyncSessionLocal = async_sessionmaker(bind=sqlite_engine, class_=AsyncSession, expire_on_commit=False)
    yield


settings = get_settings()

app = FastAPI(
    title="PO Financing Platform API",
    description="Manual-underwriting purchase-order financing platform. "
    "All approval decisions are made by human administrators — no automated "
    "risk scoring is performed by this service.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS - strict allow-list
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.onrender\.com|https://.*\.vercel\.app|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}


app.include_router(users.router)
app.include_router(documents.router)
app.include_router(purchase_orders.router)
app.include_router(applications.router)
