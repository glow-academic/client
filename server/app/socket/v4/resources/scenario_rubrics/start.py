"""ScenarioRubrics resource start handler."""

from typing import Any

from app.main import sio
from app.socket.v4.resources.types import ResourceStartEvent


async def handle_start(data: dict[str, Any]) -> None:
    """ScenarioRubrics generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = ResourceStartEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type="scenario_rubrics",
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "scenario_rubrics_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )
