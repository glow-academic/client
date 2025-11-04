"""Home v3 API router."""

from fastapi import APIRouter

from app.api.v3.home.overview import router as overview_router

router = APIRouter(prefix="/home", tags=["home"])

router.include_router(overview_router)

