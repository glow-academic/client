"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.api.v4.artifacts.persona.get import router as get_router
from app.api.v4.artifacts.persona.list import router as list_router
from app.api.v4.artifacts.persona.save import router as save_router
from app.api.v4.artifacts.persona.duplicate import router as duplicate_router
from app.api.v4.artifacts.persona.delete import router as delete_router
from app.api.v4.artifacts.persona.draft import router as draft_router

router = APIRouter(prefix="/personas", tags=["personas"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
