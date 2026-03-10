"""Benchmark test artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.test.archive import router as archive_router
from app.routes.v5.api.main.test.docs import router as docs_router
from app.routes.v5.api.main.test.end import router as end_router
from app.routes.v5.api.main.test.export import router as export_router
from app.routes.v5.api.main.test.get import router as get_router
from app.routes.v5.api.main.test.next import router as next_router
from app.routes.v5.api.main.test.refresh import router as refresh_router
from app.routes.v5.api.main.test.run import router as run_router
from app.routes.v5.api.main.test.search import router as search_router
from app.routes.v5.api.main.test.start import router as start_router
from app.routes.v5.api.main.test.stop import router as stop_router

router = APIRouter(prefix="/test", tags=["artifacts", "test"])

router.include_router(get_router)
router.include_router(archive_router)
router.include_router(refresh_router)
router.include_router(export_router)
router.include_router(docs_router)
# Socket event API equivalents
router.include_router(start_router)
router.include_router(next_router)
router.include_router(run_router)
router.include_router(end_router)
router.include_router(stop_router)
router.include_router(search_router)
