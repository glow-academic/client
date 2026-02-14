"""Audit views router."""

from fastapi import APIRouter

from app.api.v4.views.audit.list import router as list_router

router = APIRouter(prefix="/audit", tags=["views", "audit"])

router.include_router(list_router)
