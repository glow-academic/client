"""Attempt simulation permission helpers.

Extends base GenerationContext with simulation-specific validation.
Validates:
- Base prerequisites (agent, model, API key, rate limit)
- Simulation exists and is accessible
- Attempt/chat state is valid for the operation
- Entry types are valid for the handler
"""

from dataclasses import dataclass, field
from uuid import UUID

from app.socket.v4.artifacts.permissions import (
    GenerationContext,
    format_generation_error,
    validate_generation_access,
)


@dataclass
class AttemptGenerationContext(GenerationContext):
    """Extended context for attempt simulation generation.

    Adds simulation-specific fields to base GenerationContext.
    """

    # Simulation access
    simulation_exists: bool = False
    simulation_is_active: bool = False
    simulation_id: UUID | None = None
    simulation_name: str | None = None

    # Attempt/Chat state
    attempt_id: UUID | None = None
    attempt_exists: bool = False
    attempt_is_active: bool = False
    chat_id: UUID | None = None
    chat_exists: bool = False
    chat_is_completed: bool = False

    # Entry types validation
    requested_entry_types: list[str] = field(default_factory=list)
    valid_entry_types: list[str] = field(default_factory=list)

    # Profile access
    profile_has_access: bool = False


def validate_attempt_access(ctx: AttemptGenerationContext) -> tuple[bool, list[str]]:
    """Validate all prerequisites for attempt simulation generation.

    Performs base validation plus simulation-specific checks:
    1. Base validation (agent, model, API key, rate limit)
    2. Simulation exists and is active
    3. Profile has access to simulation
    4. Entry types are valid (if requested)

    Args:
        ctx: AttemptGenerationContext populated from SQL

    Returns:
        (is_valid, failure_reasons) - If is_valid is False, failure_reasons contains messages
    """
    failures: list[str] = []

    # Step 1: Base validation (agent, model, API key, rate limit)
    is_valid, base_failures = validate_generation_access(ctx)
    if not is_valid:
        return False, base_failures

    # Step 2: Simulation exists
    if not ctx.simulation_exists:
        failures.append("Simulation does not exist")
        return False, failures

    # Step 3: Simulation is active
    if not ctx.simulation_is_active:
        failures.append(f"Simulation '{ctx.simulation_name}' is not active")

    # Step 4: Profile has access
    # Skip cohort access check if user already has an active attempt (implies access was granted)
    if not ctx.profile_has_access and not ctx.attempt_exists:
        failures.append(f"You do not have access to simulation '{ctx.simulation_name}'")

    # Step 5: Validate entry types (if provided)
    if ctx.requested_entry_types:
        invalid_types = [
            et for et in ctx.requested_entry_types if et not in ctx.valid_entry_types
        ]
        if invalid_types:
            failures.append(f"Invalid entry types: {', '.join(invalid_types)}")

    return len(failures) == 0, failures


def validate_attempt_message_access(
    ctx: AttemptGenerationContext,
) -> tuple[bool, list[str]]:
    """Validate prerequisites for attempt_message event.

    In addition to attempt_access validation, checks:
    - Attempt exists and is active
    - Chat exists and is not completed

    Args:
        ctx: AttemptGenerationContext populated from SQL

    Returns:
        (is_valid, failure_reasons)
    """
    # First run base attempt validation
    is_valid, failures = validate_attempt_access(ctx)
    if not is_valid:
        return False, failures

    # Check attempt exists and is active
    if not ctx.attempt_exists:
        failures.append("Attempt does not exist")
        return False, failures

    if not ctx.attempt_is_active:
        failures.append("Attempt is no longer active")

    # Check chat exists and is not completed
    if not ctx.chat_exists:
        failures.append("Chat does not exist")
        return False, failures

    if ctx.chat_is_completed:
        failures.append("Chat has already been completed")

    return len(failures) == 0, failures


def validate_attempt_grade_access(
    ctx: AttemptGenerationContext,
) -> tuple[bool, list[str]]:
    """Validate prerequisites for attempt_grade event (grading).

    In addition to attempt_access validation, checks:
    - Attempt exists (can be active or completed for grading)

    Args:
        ctx: AttemptGenerationContext populated from SQL

    Returns:
        (is_valid, failure_reasons)
    """
    # First run base attempt validation
    is_valid, failures = validate_attempt_access(ctx)
    if not is_valid:
        return False, failures

    # Check attempt exists
    if not ctx.attempt_exists:
        failures.append("Attempt does not exist")
        return False, failures

    return len(failures) == 0, failures


__all__ = [
    "AttemptGenerationContext",
    "validate_attempt_access",
    "validate_attempt_message_access",
    "validate_attempt_grade_access",
    "format_generation_error",
]
