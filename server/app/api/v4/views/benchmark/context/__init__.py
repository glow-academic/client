"""Benchmark context view router."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.context.get import router as get_router

router = APIRouter(prefix="/context", tags=["views", "benchmark", "context"])

router.include_router(get_router)
