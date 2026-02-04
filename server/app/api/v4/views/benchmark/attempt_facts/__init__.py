"""Benchmark attempt facts view router."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.attempt_facts.get import router as get_router

router = APIRouter()
router.include_router(get_router)
