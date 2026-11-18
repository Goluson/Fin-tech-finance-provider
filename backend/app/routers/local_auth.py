"""
Local / mock-mode authentication endpoints.

Used ONLY when Cognito is not configured (dev / demo environments).
Persists all state to the database so it survives server restarts.

Endpoints
---------
POST /api/auth/signup          Register with email + password (sends OTP)
POST /api/auth/verify-email    Submit OTP to confirm the account
POST /api/auth/signin          Authenticate and receive a mock JWT
POST /api/auth/resend-otp      Re-send a fresh OTP
"""
import base64
import hashlib
import hmac
import json
import random
import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Boolean, Column, DateTime, String, Text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base, get_db
from app.models import User, UserRole

router = APIRouter(prefix="/api/auth", tags=["local-auth"])


# ---------------------------------------------------------------------------
# DB model — persists signup state across restarts
# ---------------------------------------------------------------------------

class LocalAuthPending(Base):
    """Stores pending (not-yet-verified) and verified signup records."""
    __tablename__ = "local_auth_pending"

    email        = Column(String(255), primary_key=True)
    password_hash = Column(Text,    nullable=False)
    salt         = Column(String(64), nullable=False)
    otp          = Column(String(10), nullable=False)
    otp_expires  = Column(DateTime(timezone=True), nullable=False)
    verified     = Column(Boolean, default=False, nullable=False)
    company_name = Column(String(255), nullable=False, default="")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return dk.hex(), salt


def _verify_password(password: str, stored_hash: str, salt: str) -> bool:
    candidate, _ = _hash_password(password, salt)
    return hmac.compare_digest(candidate, stored_hash)


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _make_mock_token(email: str, sub: str) -> str:
    header = base64.b64encode(
        json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    ).decode().rstrip("=")
    payload_data = {
        "sub": sub,
        "email": email,
        "email_verified": True,
        "token_use": "id",
        "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
    }
    payload = base64.b64encode(
        json.dumps(payload_data).encode()
    ).decode().rstrip("=")
    return f"{header}.{payload}.mock-sig"


def _sub_for_email(email: str) -> str:
    return "mock-sub-" + base64.b64encode(email.encode()).decode().rstrip("=")


def _print_otp(email: str, otp: str):
    print(f"\n{'='*60}")
    print(f"  📧  EMAIL VERIFICATION OTP")
    print(f"  To:  {email}")
    print(f"  OTP: {otp}")
    print(f"{'='*60}\n", flush=True)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    company_name: str = Field(min_length=1, max_length=255)


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class ResendOtpRequest(BaseModel):
    email: EmailStr


class AuthResponse(BaseModel):
    id_token: str
    message: str = "ok"


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=MessageResponse, status_code=201)
async def signup(payload: SignUpRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()

    # Block if already a full user in DB
    existing_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    pw_hash, salt = _hash_password(payload.password)
    otp = _generate_otp()
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Upsert into local_auth_pending (re-signup resets OTP)
    existing_pending = (await db.execute(
        select(LocalAuthPending).where(LocalAuthPending.email == email)
    )).scalar_one_or_none()

    if existing_pending and existing_pending.verified:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    if existing_pending:
        existing_pending.password_hash = pw_hash
        existing_pending.salt = salt
        existing_pending.otp = otp
        existing_pending.otp_expires = otp_expires
        existing_pending.verified = False
        existing_pending.company_name = payload.company_name
    else:
        db.add(LocalAuthPending(
            email=email,
            password_hash=pw_hash,
            salt=salt,
            otp=otp,
            otp_expires=otp_expires,
            verified=False,
            company_name=payload.company_name,
        ))

    await db.commit()
    _print_otp(email, otp)
    return {"message": f"Verification code sent to {email}. Check the backend console for the OTP (local dev mode)."}


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()
    pending = (await db.execute(
        select(LocalAuthPending).where(LocalAuthPending.email == email)
    )).scalar_one_or_none()

    if pending is None:
        raise HTTPException(status_code=404, detail="No pending signup found for this email. Please sign up first.")
    if pending.verified:
        return {"message": "Email already verified. You can sign in."}

    now = datetime.now(timezone.utc)
    exp = pending.otp_expires
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    if not hmac.compare_digest(pending.otp, payload.otp.strip()):
        raise HTTPException(status_code=400, detail="Incorrect verification code.")

    pending.verified = True
    await db.commit()
    return {"message": "Email verified. You can now sign in."}


@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(payload: ResendOtpRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()
    pending = (await db.execute(
        select(LocalAuthPending).where(LocalAuthPending.email == email)
    )).scalar_one_or_none()

    if pending is None:
        raise HTTPException(status_code=404, detail="No pending signup found for this email. Please sign up first.")
    if pending.verified:
        return {"message": "Email is already verified. You can sign in."}

    otp = _generate_otp()
    pending.otp = otp
    pending.otp_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.commit()
    _print_otp(email, otp)
    return {"message": f"New verification code sent to {email}."}


@router.post("/signin", response_model=AuthResponse)
async def signin(payload: SignInRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()

    db_user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    pending = (await db.execute(
        select(LocalAuthPending).where(LocalAuthPending.email == email)
    )).scalar_one_or_none()

    # --- Unverified: block login ---
    if pending is not None and not pending.verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email first. Enter the OTP sent to your email (check the backend console).",
        )

    # --- Verified pending record exists: check password ---
    if pending is not None and pending.verified:
        if not _verify_password(payload.password, pending.password_hash, pending.salt):
            raise HTTPException(status_code=401, detail="Incorrect email or password.")

        # Create DB user on first login if needed
        if db_user is None:
            role = UserRole.ADMIN if "admin" in email else UserRole.SUPPLIER
            db_user = User(
                cognito_sub=_sub_for_email(email),
                email=email,
                role=role,
                company_name=pending.company_name,
            )
            db.add(db_user)
            await db.commit()

        token = _make_mock_token(email, _sub_for_email(email))
        return {"id_token": token, "message": "Signed in successfully."}

    # --- DB user exists but no pending record (seeded/migrated user) ---
    # In local dev allow login — user just needs to sign up once to set a password.
    if db_user is not None and pending is None:
        raise HTTPException(
            status_code=401,
            detail="No password set for this account. Please use 'Supplier sign up' to register your password first.",
        )

    # --- No account at all ---
    raise HTTPException(
        status_code=401,
        detail="No account found for this email. Please sign up first.",
    )
