"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.api.v4.artifacts.agent.delete import router as delete_router
from app.api.v4.artifacts.agent.draft import router as draft_router
from app.api.v4.artifacts.agent.duplicate import router as duplicate_router
from app.api.v4.artifacts.agent.get import router as get_router
from app.api.v4.artifacts.agent.list import router as list_router
from app.api.v4.artifacts.agent.save import router as save_router

router = APIRouter(prefix="/agents", tags=["agents"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
