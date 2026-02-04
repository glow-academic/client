"""Benchmark views API routes."""

from fastapi import APIRouter

from app.api.v4.views.benchmark.attempt_facts import router as attempt_facts_router
from app.api.v4.views.benchmark.chats import router as chats_router
from app.api.v4.views.benchmark.eval_summary import router as eval_summary_router
from app.api.v4.views.benchmark.messages import router as messages_router
from app.api.v4.views.benchmark.tests import router as tests_router

router = APIRouter(prefix="/benchmark", tags=["views", "benchmark"])

router.include_router(tests_router)
router.include_router(chats_router)
router.include_router(messages_router)
router.include_router(
    attempt_facts_router, prefix="/attempt-facts", tags=["attempt_facts"]
)
router.include_router(
    eval_summary_router, prefix="/eval-summary", tags=["eval_summary"]
)
