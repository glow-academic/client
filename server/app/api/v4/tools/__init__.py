"""Tools v4 router."""

from fastapi import APIRouter

from app.api.v4.tools.get import router as get_router
from app.api.v4.tools.list import router as list_router
from app.api.v4.tools.save import router as save_router

router = APIRouter(prefix="/tools", tags=["tools"])

# Include all tool endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
