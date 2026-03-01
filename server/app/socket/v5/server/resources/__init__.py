"""Resource generation server handlers + OpenAPI routes."""

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter

from app.registry.resource_events import RESOURCE_EVENTS

from . import complete, error, progress, started  # noqa: F401

server_router = APIRouter()
PHASES = ["started", "progress", "complete", "error"]

for resource_type, EventClass in RESOURCE_EVENTS.items():
    for phase in PHASES:
        route_path = f"/{resource_type}_generation_{phase}"

        def _make_endpoint(cls: type = EventClass) -> Callable[..., Any]:
            async def endpoint(request: cls) -> dict[str, bool]:  # type: ignore[valid-type]
                return {"success": True}

            return endpoint

        server_router.add_api_route(
            route_path,
            _make_endpoint(),
            methods=["POST"],
            name=f"{resource_type}_generation_{phase}",
            summary=f"{resource_type} generation {phase}",
        )
