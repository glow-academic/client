"""Scenarios v3 router."""

from app.api.v3.scenarios.create import router as create_router
from app.api.v3.scenarios.delete import router as delete_router
from app.api.v3.scenarios.detail import router as detail_router
from app.api.v3.scenarios.detail_default import router as detail_default_router
from app.api.v3.scenarios.duplicate import router as duplicate_router
from app.api.v3.scenarios.generate_ai import router as generate_ai_router
from app.api.v3.scenarios.list import router as list_router
from app.api.v3.scenarios.overview import router as overview_router
from app.api.v3.scenarios.randomize import router as randomize_router
from app.api.v3.scenarios.search import router as search_router
from app.api.v3.scenarios.select_attributes import router as select_attributes_router
from app.api.v3.scenarios.update import router as update_router
from fastapi import APIRouter

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

# Include all scenario endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_default_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(generate_ai_router)
router.include_router(randomize_router)
router.include_router(select_attributes_router)
router.include_router(overview_router)
router.include_router(search_router)

