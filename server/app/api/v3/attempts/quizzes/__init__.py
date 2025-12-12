"""Quizzes resource router."""

from fastapi import APIRouter

router = APIRouter(prefix="/quizzes", tags=["attempts", "quizzes"])

# Quiz operations are now handled via WebSocket events
# See server/app/socket/quizzes/ for WebSocket handlers
