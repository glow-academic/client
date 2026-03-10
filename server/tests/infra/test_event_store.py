"""Tests for the naive call-receipt event store helpers."""

from datetime import datetime
from uuid import uuid4

from app.infra.events.store import _project_call_receipt, build_event_cursor


def test_project_call_receipt_emits_domain_and_lifecycle_events() -> None:
    call_id = uuid4()
    tool_id = uuid4()
    entity_id = uuid4()
    created_at = datetime(2026, 3, 10, 12, 0, 0)

    events = _project_call_receipt(
        artifact="persona",
        operation="get",
        entity_id=entity_id,
        created_at=created_at,
        call_id=call_id,
        tool_id=tool_id,
        receipt={
            "arguments": {"persona_id": str(entity_id)},
            "output": {"success": True, "results": []},
        },
    )

    assert [event.event_type for event in events] == [
        "call.started",
        "call.completed",
        "persona.viewed",
    ]
    assert events[-1].entity_id == entity_id
    assert build_event_cursor(events[-1]).startswith(created_at.isoformat())


def test_project_call_receipt_skips_domain_events_on_failure() -> None:
    events = _project_call_receipt(
        artifact="persona",
        operation="update",
        entity_id=uuid4(),
        created_at=datetime(2026, 3, 10, 12, 0, 0),
        call_id=uuid4(),
        tool_id=uuid4(),
        receipt={
            "arguments": {},
            "output": {"success": False, "message": "bad"},
        },
    )

    assert [event.event_type for event in events] == [
        "call.started",
        "call.failed",
    ]
