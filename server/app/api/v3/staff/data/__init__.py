"""Staff data operations router."""

from fastapi import APIRouter

from .create import router as create_router

router = APIRouter(prefix="/data", tags=["staff"])

# Include data operation routers
router.include_router(create_router)

