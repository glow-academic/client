"""General attempts router."""

from fastapi import APIRouter

from app.api.v4.attempts.general.get import router as get_router

router = APIRouter(prefix="/general", tags=["attempts", "general"])

router.include_router(get_router)
