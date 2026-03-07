"""Practice artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.practice.export import router as export_router
from app.routes.v5.api.main.practice.get import router as get_router
from app.routes.v5.api.main.practice.list import router as list_router

router = APIRouter(prefix="/practice", tags=["artifacts", "practice"])

router.include_router(get_router)
router.include_router(list_router)
router.include_router(export_router)
