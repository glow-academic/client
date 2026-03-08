"""Practice artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.practice.docs import router as docs_router
from app.routes.v5.api.main.practice.export import router as export_router
from app.routes.v5.api.main.practice.get import router as get_router
from app.routes.v5.api.main.practice.search import router as search_router
from app.routes.v5.api.main.practice.refresh import router as refresh_router

router = APIRouter(prefix="/practice", tags=["artifacts", "practice"])

router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)
