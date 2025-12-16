"""Reports bundle router - base router for reports endpoints."""

from fastapi import APIRouter

router = APIRouter(prefix="/reports", tags=["reports"])

