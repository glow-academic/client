"""Test permission helpers.

Validates test run prerequisites. Keeps logic minimal and explicit.

Checks:
- Chat exists and is active
- Group has config (agent, model, API key)
- There are pending runs to execute
"""

from dataclasses import dataclass, field
from uuid import UUID

from app.socket.v4.artifacts.permissions import (
    GenerationContext,
    format_generation_error,
    validate_generation_access,
)


@dataclass
class TestRunContext(GenerationContext):
    """Extended context for test run generation.

    Adds test-specific fields to base GenerationContext.
    """

    # Chat state
    chat_id: UUID | None = None
    chat_exists: bool = False
    chat_is_active: bool = False

    # Attempt state
    attempt_id: UUID | None = None
    attempt_exists: bool = False

    # Group config (source of agent/model config)
    group_id: UUID | None = None
    group_exists: bool = False

    # Run state
    has_pending_runs: bool = False
    next_run_resource_id: UUID | None = None
    total_runs: int = 0
    completed_runs: int = 0

    # Rubric for grading
    rubric_id: UUID | None = None


def validate_test_run_access(ctx: TestRunContext) -> tuple[bool, list[str]]:
    """Validate all prerequisites for test run execution.

    Checks:
    1. Base validation (agent, model, API key, rate limit)
    2. Chat exists and is active
    3. Group exists
    4. There are pending runs

    Args:
        ctx: TestRunContext populated from SQL

    Returns:
        (is_valid, failure_reasons)
    """
    failures: list[str] = []

    # Step 1: Base validation (agent, model, API key, rate limit)
    is_valid, base_failures = validate_generation_access(ctx)
    if not is_valid:
        return False, base_failures

    # Step 2: Chat exists
    if not ctx.chat_exists:
        failures.append("Test chat does not exist")
        return False, failures

    # Step 3: Chat is active
    if not ctx.chat_is_active:
        failures.append("Test chat is no longer active")

    # Step 4: Group exists
    if not ctx.group_exists:
        failures.append("Test configuration (group) not found")

    # Step 5: Has pending runs
    if not ctx.has_pending_runs:
        failures.append("No pending runs to execute")

    return len(failures) == 0, failures


def validate_test_grade_access(ctx: TestRunContext) -> tuple[bool, list[str]]:
    """Validate prerequisites for test grading.

    Checks:
    1. Base validation (agent, model, API key)
    2. Chat exists
    3. Rubric exists

    Args:
        ctx: TestRunContext populated from SQL

    Returns:
        (is_valid, failure_reasons)
    """
    failures: list[str] = []

    # Step 1: Base validation
    is_valid, base_failures = validate_generation_access(ctx)
    if not is_valid:
        return False, base_failures

    # Step 2: Chat exists
    if not ctx.chat_exists:
        failures.append("Test chat does not exist")
        return False, failures

    # Step 3: Rubric exists
    if not ctx.rubric_id:
        failures.append("No rubric configured for grading")

    return len(failures) == 0, failures


__all__ = [
    "TestRunContext",
    "validate_test_run_access",
    "validate_test_grade_access",
    "format_generation_error",
]
