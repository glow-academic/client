"""Profile v3 API endpoints."""

from fastapi import APIRouter

from .authorize_emulation import router as authorize_emulation_router
from .by_alias import router as by_alias_router
from .context import router as context_router
from .detail import router as detail_router
from .mark_chat_complete import router as mark_chat_complete_router
from .mark_intro_complete import router as mark_intro_complete_router
from .overview import router as overview_router
from .search import router as search_router
from .search_simulatable_profiles import (
    router as search_simulatable_profiles_router,
)
from .simulation_report import router as simulation_report_router
from .staff import router as staff_router
from .update import router as update_router

router = APIRouter(prefix="/profile", tags=["profile"])

# Include all profile endpoint routers
router.include_router(detail_router)
router.include_router(update_router)
router.include_router(by_alias_router)
router.include_router(context_router)
router.include_router(authorize_emulation_router)
router.include_router(mark_intro_complete_router)
router.include_router(mark_chat_complete_router)
router.include_router(overview_router)
router.include_router(search_router)
router.include_router(search_simulatable_profiles_router)
router.include_router(simulation_report_router)
# Include staff management routers
router.include_router(staff_router)
