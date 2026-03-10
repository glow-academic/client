"""Minimal webhook delivery helpers for event envelopes."""

from __future__ import annotations

import asyncio
import json
import os
from urllib import request

from app.routes.v5.api.events.types import EventEnvelope

_DEFAULT_LICENSE_WEBHOOKS: dict[str, str] = {
    "demo-license-key": "http://localhost:9000/events",
}


def resolve_webhook_target(license_key: str) -> str | None:
    """Resolve a webhook URL for a license key.

    TODO: Replace this with a proper subscription/service lookup.
    """
    env_key = f"EVENT_WEBHOOK_{license_key.upper().replace('-', '_')}"
    return os.getenv(env_key) or _DEFAULT_LICENSE_WEBHOOKS.get(license_key)


async def deliver_events_to_webhook(
    webhook_url: str,
    events: list[EventEnvelope],
) -> None:
    """POST event envelopes to a webhook endpoint."""
    payload = {
        "events": [event.model_dump(mode="json") for event in events],
    }

    def _post() -> None:
        req = request.Request(
            webhook_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=10):
            return

    await asyncio.to_thread(_post)
