"""Session artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.session.get import router as get_router
from app.api.v4.artifacts.session.list import router as list_router

router = APIRouter(prefix="/session", tags=["artifacts", "session"])

router.include_router(get_router)
router.include_router(list_router)
