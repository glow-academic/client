"""Persona generation permission helpers.

Business logic for validating persona generation prerequisites.
SQL fetches raw data, Python applies the rules.
"""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class GenerationContext:
    """Raw context data from SQL for generation validation."""

    agent_exists: bool
    agent_name: str | None
    agent_is_active: bool
    model_id: UUID | None
    model_name: str | None
    provider_id: UUID | None
    provider_name: str | None
    has_api_key: bool
    requests_per_day: int | None  # None = unlimited
    runs_today: int


def validate_generation_access(ctx: GenerationContext) -> tuple[bool, list[str]]:
    """Validate all prerequisites for persona generation.

    Returns:
        (is_valid, failure_reasons) - If is_valid is False, failure_reasons contains messages
    """
    failures: list[str] = []

    # Check 1: Agent exists
    if not ctx.agent_exists:
        failures.append("Agent does not exist")
        return False, failures  # Early return - can't check further

    # Check 2: Agent is active
    if not ctx.agent_is_active:
        failures.append(f"Agent '{ctx.agent_name}' is not active")

    # Check 3: Agent has model
    if not ctx.model_id:
        failures.append(f"Agent '{ctx.agent_name}' has no model configured")

    # Check 4: Model has provider
    elif not ctx.provider_id:
        failures.append(f"Model '{ctx.model_name}' has no provider configured")

    # Check 5: Provider has API key
    elif not ctx.has_api_key:
        failures.append(f"No API key configured for provider '{ctx.provider_name}'")

    # Check 6: Rate limit (NULL = unlimited = always OK)
    if ctx.requests_per_day is not None:
        if ctx.runs_today >= ctx.requests_per_day:
            failures.append(
                f"Rate limit exceeded ({ctx.runs_today}/{ctx.requests_per_day} requests today)"
            )

    return len(failures) == 0, failures


def format_generation_error(failures: list[str]) -> str:
    """Format failure reasons into user-friendly error message."""
    if not failures:
        return "Unknown error"
    return "; ".join(failures)
