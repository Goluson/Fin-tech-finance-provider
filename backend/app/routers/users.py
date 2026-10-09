"""
User registration & profile endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import AuthenticatedCognitoUser, get_current_user, verify_cognito_token
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserCreate,
    cognito_user: AuthenticatedCognitoUser = Depends(verify_cognito_token),
    db: AsyncSession = Depends(get_db),
):
    """Registers a new application user, linked to an already-created
    AWS Cognito account. Idempotent: if the Cognito sub already has a
    profile, returns the existing profile instead of erroring, so the
    frontend can safely call this after every sign-up/sign-in."""
    existing = await db.execute(select(User).where(User.cognito_sub == cognito_user.sub))
    existing_user = existing.scalar_one_or_none()
    if existing_user is not None:
        return existing_user

    if not cognito_user.email:
        raise HTTPException(status_code=400, detail="Cognito account has no email on file.")

    # Link an existing supplier/admin row after migration using the verified
    # Cognito email. This preserves applications and role assignments.
    if cognito_user.email_verified:
        by_email = await db.execute(select(User).where(User.email == cognito_user.email))
        existing_email_user = by_email.scalar_one_or_none()
        if existing_email_user is not None:
            existing_email_user.cognito_sub = cognito_user.sub
            await db.commit()
            await db.refresh(existing_email_user)
            return existing_email_user

    # NOTE: role is accepted from the client only for the SUPPLIER case in
    # this MVP. Granting ADMIN must be done as a manual, internal operation
    # (e.g. direct database update by an operator) — never self-service.
    new_user = User(
        cognito_sub=cognito_user.sub,
        email=cognito_user.email,
        role=payload.role if payload.role.value == "SUPPLIER" else "SUPPLIER",
        company_name=payload.company_name,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.get("/me", response_model=UserOut)
async def get_my_profile(user: User = Depends(get_current_user)):
    return user
