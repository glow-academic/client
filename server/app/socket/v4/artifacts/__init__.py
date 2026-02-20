"""Artifacts generation handlers - unified entry point for text/image/video/audio generation."""

from fastapi import APIRouter

from . import (
    activity,
    attempt,
    audio_events,
    audio_session,
    auth,
    benchmark,
    call_events,
    chat,
    dashboard,
    generate,
    group,
    health,
    home,
    invocation,
    leaderboard,
    practice,
    pricing,
    record,
    reports,
    session,
    simulation,
    test,
)

__all__ = [
    "activity",
    "attempt",
    "audio_events",
    "audio_session",
    "auth",
    "benchmark",
    "call_events",
    "dashboard",
    "generate",
    "group",
    "health",
    "home",
    "leaderboard",
    "practice",
    "pricing",
    "record",
    "reports",
    "session",
    "simulation",
    "invocation",
    "test",
    "chat",
]

# Export routers for inclusion in main router
client_router = APIRouter()
server_router = APIRouter()

# Register client-to-server events
client_router.include_router(auth.client_router)
client_router.include_router(chat.client_router)
client_router.include_router(attempt.client_router)
client_router.include_router(benchmark.client_router)
client_router.include_router(test.client_router)
client_router.include_router(home.client_router)
client_router.include_router(practice.client_router)
client_router.include_router(activity.client_router)
client_router.include_router(record.client_router)
client_router.include_router(invocation.client_router)
client_router.include_router(dashboard.client_router)
client_router.include_router(leaderboard.client_router)
client_router.include_router(reports.client_router)
client_router.include_router(pricing.client_router)
client_router.include_router(session.client_router)
client_router.include_router(group.client_router)
client_router.include_router(health.client_router)

# Register server-to-server events (internal event listeners)
server_router.include_router(auth.server_router)
server_router.include_router(chat.server_router)
server_router.include_router(attempt.server_router)
server_router.include_router(benchmark.server_router)
server_router.include_router(test.server_router)
server_router.include_router(simulation.server_router)
server_router.include_router(home.server_router)
server_router.include_router(practice.server_router)
server_router.include_router(call_events.server_router)
server_router.include_router(activity.server_router)
server_router.include_router(record.server_router)
server_router.include_router(invocation.server_router)
server_router.include_router(dashboard.server_router)
server_router.include_router(leaderboard.server_router)
server_router.include_router(reports.server_router)
server_router.include_router(pricing.server_router)
server_router.include_router(session.server_router)
server_router.include_router(group.server_router)
server_router.include_router(health.server_router)
