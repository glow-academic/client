"""Login views API routes."""

from fastapi import APIRouter

from app.api.v4.views.login.list import router as list_router

router = APIRouter(prefix="/login", tags=["views", "login"])

router.include_router(list_router, prefix="/list", tags=["list"])
