"""Grant views API routes."""

from fastapi import APIRouter

from app.api.v4.views.grant.list import router as list_router

router = APIRouter(prefix="/grant", tags=["views", "grant"])

router.include_router(list_router, prefix="/list", tags=["list"])
