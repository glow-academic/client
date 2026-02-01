"""Training simulation permission helpers.

Extends base GenerationContext with simulation-specific validation.
Validates:
- Base prerequisites (agent, model, API key, rate limit)
- Simulation exists and is accessible
- Profile has access to simulation
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
class TrainingGenerationContext(GenerationContext):
    """Extended context for training simulation generation.

    Adds simulation-specific fields to base GenerationContext.
    """

    # Simulation access
    simulation_exists: bool = False
    simulation_is_active: bool = False
    simulation_id: UUID | None = None
    simulation_name: str | None = None

    # Profile access
    profile_has_access: bool = False

    # Scenario content checks
    has_problem_statement: bool = False
    has_persona: bool = False

    # Entry types validation
    requested_entry_types: list[str] = field(default_factory=list)
    valid_entry_types: list[str] = field(default_factory=list)


def validate_training_access(ctx: TrainingGenerationContext) -> tuple[bool, list[str]]:
    """Validate all prerequisites for training simulation generation.

    Performs base validation plus simulation-specific checks:
    1. Base validation (agent, model, API key, rate limit)
    2. Simulation exists and is active
    3. Profile has access to simulation
    4. Entry types are valid (if requested)

    Args:
        ctx: TrainingGenerationContext populated from SQL

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
    if not ctx.profile_has_access:
        failures.append(f"You do not have access to simulation '{ctx.simulation_name}'")

    # Step 5: Validate entry types (if provided)
    if ctx.requested_entry_types:
        invalid_types = [
            et for et in ctx.requested_entry_types if et not in ctx.valid_entry_types
        ]
        if invalid_types:
            failures.append(f"Invalid entry types: {', '.join(invalid_types)}")

    return len(failures) == 0, failures


def check_scenario_needs_generation(ctx: TrainingGenerationContext) -> bool:
    """Check if scenario needs AI generation.

    A scenario needs generation if it's missing required content:
    - problem_statement
    - persona

    Args:
        ctx: TrainingGenerationContext with scenario content flags

    Returns:
        True if scenario needs generation, False if content exists
    """
    return not ctx.has_problem_statement or not ctx.has_persona


__all__ = [
    "TrainingGenerationContext",
    "validate_training_access",
    "check_scenario_needs_generation",
    "format_generation_error",
]
