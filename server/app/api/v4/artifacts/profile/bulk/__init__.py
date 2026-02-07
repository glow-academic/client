"""Profile bulk operations router."""

from fastapi import APIRouter

from app.api.v4.artifacts.profile.bulk.delete import router as delete_router
from app.api.v4.artifacts.profile.bulk.process import router as process_router
from app.api.v4.artifacts.profile.bulk.save import router as save_router
from app.api.v4.artifacts.profile.bulk.search import router as search_router

router = APIRouter(prefix="/bulk", tags=["profiles", "bulk"])

router.include_router(process_router)
router.include_router(search_router)
router.include_router(save_router)
router.include_router(delete_router)
