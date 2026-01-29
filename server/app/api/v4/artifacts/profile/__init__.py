"""Profile v4 router."""

from fastapi import APIRouter

from app.api.v4.artifacts.profile.delete import router as delete_router
from app.api.v4.artifacts.profile.draft import router as draft_router
from app.api.v4.artifacts.profile.get import router as get_router
from app.api.v4.artifacts.profile.list import router as list_router
from app.api.v4.artifacts.profile.save import router as save_router

router = APIRouter(prefix="/profiles", tags=["profiles"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(draft_router)
router.include_router(delete_router)
