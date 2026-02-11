"""Benchmark bundle view router."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.bundle.get import router as get_router

router = APIRouter(prefix="/bundle", tags=["views", "benchmark", "bundle"])

router.include_router(get_router)
