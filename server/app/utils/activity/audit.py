"""Activity audit dependency utilities."""

from dataclasses import dataclass
from typing import Any

from fastapi import Depends, Request
from jinja2 import Environment, StrictUndefined

jinja = Environment(undefined=StrictUndefined, autoescape=False)


@dataclass
class AuditIntent:
    """Audit intent with event key and template."""

    event_key: str
    template: str


def audit_activity(event_key: str, template: str) -> Any:
    """Dependency that sets audit intent and initializes context in request.state.

    Args:
        event_key: Stable identifier for the event (e.g., "persona.created")
        template: Jinja2 template string for the activity message

    Returns:
        FastAPI dependency that sets audit_intent and initializes audit_ctx
    """

    async def _audit(request: Request) -> None:
        request.state.audit_intent = AuditIntent(event_key=event_key, template=template)
        request.state.audit_ctx = {}  # endpoint will add safe fields here

    return Depends(_audit)


def audit_set(request: Request, **kwargs: Any) -> None:
    """Helper to set safe fields in audit context from endpoint.

    Args:
        request: FastAPI request object
        **kwargs: Fields to add to audit context (e.g., actor={"name": "...", "id": "..."})
    """
    if not hasattr(request.state, "audit_ctx"):
        request.state.audit_ctx = {}
    request.state.audit_ctx.update(kwargs)
