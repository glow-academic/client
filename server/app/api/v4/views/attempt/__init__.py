"""Attempt views router.

Provides access to attempt-related MVs:
- list: Attempt-level detail data
- chats: Chat-level detail with grades and feedbacks
- messages: Message-level data with strengths/improvements
"""

from fastapi import APIRouter

from app.api.v4.views.attempt.chats import router as chats_router
from app.api.v4.views.attempt.list import router as list_router
from app.api.v4.views.attempt.messages import router as messages_router

router = APIRouter(prefix="/attempt", tags=["views", "attempt"])

router.include_router(list_router)
router.include_router(chats_router)
router.include_router(messages_router)
