"""Private S3 storage using short-lived presigned URLs for PDFs (with local mock fallback)."""
import uuid
from datetime import timedelta

import boto3

from app.config import get_settings

settings = get_settings()
ALLOWED_UPLOAD_CONTENT_TYPES = {"application/pdf"}


def get_s3_client():
    return boto3.client("s3", region_name=settings.aws_region)


def build_s3_object_key(supplier_id: str, file_name: str) -> str:
    return f"purchase-orders/{supplier_id}/{uuid.uuid4().hex}.pdf"


def is_mock_s3():
    return not settings.s3_bucket_name or "your_s3_bucket_name" in settings.s3_bucket_name or settings.s3_bucket_name == "mock"


def generate_upload_signed_url(s3_key: str, content_type: str) -> str:
    if content_type not in ALLOWED_UPLOAD_CONTENT_TYPES:
        raise ValueError("Only application/pdf uploads are permitted.")

    if is_mock_s3():
        return f"http://localhost:8080/api/documents/mock-upload?key={s3_key}"

    return get_s3_client().generate_presigned_url(
        "put_object", Params={"Bucket": settings.s3_bucket_name, "Key": s3_key, "ContentType": content_type},
        ExpiresIn=int(timedelta(minutes=settings.upload_url_expiration_minutes).total_seconds()),
    )


def generate_view_signed_url(s3_key: str) -> str:
    if is_mock_s3():
        return f"http://localhost:8080/api/documents/mock-view?key={s3_key}"

    return get_s3_client().generate_presigned_url(
        "get_object", Params={"Bucket": settings.s3_bucket_name, "Key": s3_key},
        ExpiresIn=int(timedelta(minutes=settings.signed_url_expiration_minutes).total_seconds()),
    )
