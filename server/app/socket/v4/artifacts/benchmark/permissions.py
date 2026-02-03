"""Benchmark permission helpers.

Validates benchmark start prerequisites. Keeps logic minimal and explicit.
"""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class BenchmarkGenerationContext:
    """Context for benchmark start validation."""

    eval_id: UUID | None
    eval_exists: bool = False


def validate_benchmark_access(
    ctx: BenchmarkGenerationContext,
) -> tuple[bool, list[str]]:
    """Validate prerequisites for benchmark start.

    Currently only checks that the eval exists.
    """
    failures: list[str] = []

    if not ctx.eval_exists or not ctx.eval_id:
        failures.append("Eval does not exist")

    return len(failures) == 0, failures


__all__ = [
    "BenchmarkGenerationContext",
    "validate_benchmark_access",
]
