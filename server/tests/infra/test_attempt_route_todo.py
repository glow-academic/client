"""Inventory tests for attempt routes that are still explicit TODO stubs."""

from __future__ import annotations

from uuid import uuid4

import pytest

STUB_ATTEMPT_ROUTES = [
    (
        "/api/v5/artifacts/attempt/audio",
        {"chat_id": str(uuid4()), "upload_id": str(uuid4())},
    ),
    (
        "/api/v5/artifacts/attempt/search",
        {"limit": 10},
    ),
]


@pytest.mark.asyncio
@pytest.mark.parametrize(("path", "payload"), STUB_ATTEMPT_ROUTES)
async def test_attempt_stub_routes_return_not_implemented(
    v5_attempt_route_client,
    attempt_route_actor,
    path,
    payload,
):
    """Document the current TODO surface until these routes are wired."""
    v5_attempt_route_client.authenticate(
        profile_id=attempt_route_actor.profile_id,
        session_id=attempt_route_actor.session_id,
    )

    response = await v5_attempt_route_client.client.post(path, json=payload)

    assert response.status_code == 501, response.text
    assert response.json() == {"detail": "Not implemented"}
