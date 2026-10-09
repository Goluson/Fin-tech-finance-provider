"""Signed URL endpoints for direct-to-S3 PDF upload/view (with mock endpoints)."""
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse

from app.auth import require_any_role
from app.config import get_settings
from app.s3 import build_s3_object_key, generate_upload_signed_url
from app.models import User
from app.schemas import UploadUrlRequest, UploadUrlResponse

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()


@router.post("/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    payload: UploadUrlRequest,
    user: User = Depends(require_any_role),
):
    """Mints a short-lived V4 signed URL the browser can PUT a PDF to
    directly. The backend never receives the file bytes."""
    if payload.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only application/pdf uploads are permitted.")

    s3_key = build_s3_object_key(str(user.id), payload.file_name)
    try:
        upload_url = generate_upload_signed_url(s3_key, payload.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return UploadUrlResponse(
        upload_url=upload_url,
        s3_key=s3_key,
        expires_in_minutes=settings.upload_url_expiration_minutes,
    )


@router.put("/mock-upload")
async def mock_upload():
    """Mock upload endpoint for offline dev testing."""
    return Response(status_code=200)


@router.get("/mock-view")
async def mock_view(key: str = ""):
    """Mock document viewer for offline dev testing."""
    return HTMLResponse("<html><body><h2>Mock Purchase Order Document</h2><p>Document Key: " + key + "</p></body></html>")
