"""Parameter items resource router."""

from fastapi import APIRouter

from app.api.v3.parameters.items.create import router as create_router

router = APIRouter(prefix="/items", tags=["parameters"])

# Include endpoint routers
router.include_router(create_router)

