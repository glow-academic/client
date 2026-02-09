"""Simulation views router.

Provides access to simulation-related MVs:
- attempts: Attempt-level detail data
- chats: Chat-level detail with grades and feedbacks
- messages: Message-level data with strengths/improvements
"""

from fastapi import APIRouter

from app.api.v4.views.simulation.attempts import router as attempts_router
from app.api.v4.views.simulation.chats import router as chats_router
from app.api.v4.views.simulation.messages import router as messages_router

router = APIRouter(prefix="/simulation", tags=["views", "simulation"])

router.include_router(attempts_router)
router.include_router(chats_router)
router.include_router(messages_router)
