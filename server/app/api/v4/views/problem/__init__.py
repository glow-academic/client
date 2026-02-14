"""Problem views API routes."""

from fastapi import APIRouter

from app.api.v4.views.problem.list import router as list_router

router = APIRouter(prefix="/problem", tags=["views", "problem"])

router.include_router(list_router, prefix="/list", tags=["list"])
