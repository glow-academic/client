"""{artifact.title()} v4 router."""

from app.api.v4.artifacts.simulation.delete import router as delete_router
from app.api.v4.artifacts.simulation.draft import router as draft_router
from app.api.v4.artifacts.simulation.duplicate import \
    router as duplicate_router
from app.api.v4.artifacts.simulation.get import router as get_router
from app.api.v4.artifacts.simulation.list import router as list_router
from app.api.v4.artifacts.simulation.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/simulations", tags=["simulations"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
