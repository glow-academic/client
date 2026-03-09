"""Record artifact router — profile report (dashboard for one profile)."""

from fastapi import APIRouter

from app.routes.v5.api.main.record.docs import router as docs_router
from app.routes.v5.api.main.record.export import router as export_router
from app.routes.v5.api.main.record.get import router as get_router
from app.routes.v5.api.main.record.refresh import router as refresh_router
from app.routes.v5.api.main.record.search import router as search_router

router = APIRouter(prefix="/record", tags=["record"])
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)
